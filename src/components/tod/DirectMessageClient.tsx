'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Loader2, MessageCircle, Plus, ChevronUp, X, Reply } from 'lucide-react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { RealtimeChannel } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { sendMessage, getSessionMessages, markSessionRead } from '@/actions/chat'
import { uploadDmPhoto } from '@/actions/dm-photos'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
// import { queueOfflineAction } from '@/lib/sync' // TODO: Update sync for chat_messages

interface DirectMessageClientProps {
    sessionId: string
    currentUser: { id: string, email?: string }
    targetProfile: { id: string, username: string | null }
}

interface Message {
    id: string
    content: string
    created_at: string
    sender_id: string
    isOwn: boolean
    isOptimistic?: boolean
    isRead?: boolean // Currently system doesn't track per-message read status easily without extensive queries
    // We can infer read status from session.last_read_at if we fetched it
    isFirstInGroup?: boolean
    isLastInGroup?: boolean
    reply_to_id?: string
    reply?: {
        id: string
        content: string
        sender_id: string
        profiles?: { username: string } // if fetched via join
    }
}

const PAGE_SIZE = 20

// Annotate messages with group metadata for messenger-style rendering
function groupMessages(msgs: Message[]): Message[] {
    return msgs.map((msg, i) => {
        const prev = msgs[i - 1]
        const next = msgs[i + 1]
        const isFirstInGroup = !prev || prev.isOwn !== msg.isOwn
        const isLastInGroup = !next || next.isOwn !== msg.isOwn
        return { ...msg, isFirstInGroup, isLastInGroup }
    })
}

// Format a date for the separator label
function formatDateSeparator(dateStr: string): string {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function DirectMessageClient({ sessionId, currentUser, targetProfile }: DirectMessageClientProps) {
    const router = useRouter()
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const initialScrollDone = useRef(false)

    // Typing State
    const [replyingTo, setReplyingTo] = useState<Message | null>(null)
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const presenceChannelRef = useRef<RealtimeChannel | null>(null)

    const supabase = useMemo(() => createClient(), [])

    const [hasMore, setHasMore] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [lastReadByPartner, setLastReadByPartner] = useState<Date | null>(null)

    // Scroll to bottom helper
    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior })
    }

    // Initial Fetch & Subscription
    useEffect(() => {
        const loadInitial = async () => {
            setIsLoading(true)

            // 1. Load cached messages from Dexie first (load last 20)
            try {
                const cached = await db.chatMessages
                    .where('session_id')
                    .equals(sessionId)
                    .sortBy('created_at')

                // Only take last 20 from cache for initial render
                const recentCached = cached.slice(-PAGE_SIZE)

                if (recentCached.length > 0) {
                    const cachedMsgs = recentCached.map(m => ({
                        id: m.id,
                        content: m.content,
                        created_at: m.created_at,
                        sender_id: m.sender_id,
                        isOwn: m.sender_id === currentUser.id,
                        isOptimistic: false,
                    }))
                    setMessages(cachedMsgs)
                    setTimeout(() => scrollToBottom('instant'), 50)
                }
            } catch { }

            // 2. Fetch from Server Action (Limit 20)
            const result = await getSessionMessages(sessionId, undefined, PAGE_SIZE)

            if (result.success && result.data) {
                const serverMsgs = result.data.map((m: any) => ({
                    id: m.id,
                    content: m.content,
                    created_at: m.created_at,
                    sender_id: m.sender_id,
                    isOwn: m.sender_id === currentUser.id,
                    isOptimistic: false
                }))

                setMessages(serverMsgs)
                setHasMore(serverMsgs.length >= PAGE_SIZE)

                // Cache in Dexie (Clear old cache? Or just merge? Merge is fine)
                const now = Date.now()
                db.chatMessages.bulkPut(
                    serverMsgs.map(m => ({
                        id: m.id,
                        session_id: sessionId,
                        sender_id: m.sender_id,
                        content: m.content,
                        created_at: m.created_at,
                        cached_at: now
                    }))
                ).catch(() => { })

                // Mark session as read
                markSessionRead(sessionId).catch(console.error)

                // Fetch partner's last read time
                const { data: partnerPart } = await supabase
                    .from('chat_participants')
                    .select('last_read_at')
                    .eq('session_id', sessionId)
                    .neq('user_id', currentUser.id)
                    .single()

                if (partnerPart?.last_read_at) {
                    setLastReadByPartner(new Date(partnerPart.last_read_at))
                }
            }

            setIsLoading(false)
            setTimeout(() => scrollToBottom('instant'), 100)
            initialScrollDone.current = true
        }

        loadInitial()

        // Realtime Subscription
        const channel = supabase
            .channel(`chat-session-${sessionId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `session_id=eq.${sessionId}`
            }, (payload) => {
                const newMsg = payload.new

                // Avoid redundant add if we sent it
                // We rely on temp ID replacement or duplicates check
                // Here we just check ID
                // Side effects
                if (newMsg.sender_id !== currentUser.id) {
                    markSessionRead(sessionId).catch(() => { })
                }
                setTimeout(() => scrollToBottom('smooth'), 100)

                setMessages(prev => {
                    // Check if the message already exists (by ID)
                    if (prev.some(m => m.id === newMsg.id)) return prev

                    // Check if we have an optimistic message that roughly matches (same content, sender, and recent)
                    // This creates a smoother transition if the temp ID hasn't been swapped yet
                    const existingOptimisticIndex = prev.findIndex(m =>
                        m.isOptimistic &&
                        m.sender_id === newMsg.sender_id &&
                        m.content === newMsg.content
                    )

                    const isOwn = newMsg.sender_id === currentUser.id

                    // Check if reply object is missing but we have reply_to_id
                    // Try to find it in current messages
                    let replyData = undefined
                    if (newMsg.reply_to_id) {
                        const parent = prev.find(m => m.id === newMsg.reply_to_id)
                        if (parent) {
                            replyData = {
                                id: parent.id,
                                content: parent.content,
                                sender_id: parent.sender_id,
                                profiles: { username: parent.isOwn ? 'You' : targetProfile.username }
                            }
                        }
                    }

                    const newMessageObj: Message = {
                        id: newMsg.id,
                        content: newMsg.content,
                        created_at: newMsg.created_at,
                        sender_id: newMsg.sender_id,
                        isOwn: isOwn,
                        isOptimistic: false,
                        reply_to_id: newMsg.reply_to_id,
                        reply: replyData
                    }

                    if (existingOptimisticIndex !== -1) {
                        // Replace the optimistic message with the real one
                        const newMessages = [...prev]
                        newMessages[existingOptimisticIndex] = newMessageObj
                        return newMessages
                    }

                    return [...prev, newMessageObj]
                })
            })
            .subscribe()

        const presenceChannel = supabase.channel(`chat-presence-${sessionId}`)
        presenceChannelRef.current = presenceChannel

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState()
                const typing = new Set<string>()
                Object.values(state).forEach((p: any) => {
                    p.forEach((u: any) => {
                        if (u.isTyping && u.user_id !== currentUser.id) {
                            typing.add(u.user_id)
                        }
                    })
                })
                setTypingUsers(typing)
                if (typing.size > 0) setTimeout(() => scrollToBottom('smooth'), 50)
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({ user_id: currentUser.id, isTyping: false })
                }
            })

        const readReceiptChannel = supabase
            .channel(`chat-read-${sessionId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'chat_participants',
                filter: `session_id=eq.${sessionId}`
            }, (payload) => {
                if (payload.new.user_id !== currentUser.id) {
                    setLastReadByPartner(new Date(payload.new.last_read_at))
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
            supabase.removeChannel(presenceChannel)
            supabase.removeChannel(readReceiptChannel)
            presenceChannelRef.current = null
        }
    }, [sessionId, currentUser.id, supabase])

    const handleTyping = async () => {
        if (!presenceChannelRef.current) return

        // Only track if not already typing (optimization could be added here, but Supabase handles dedup)
        // actually, we need to refresh the "typing" status periodically or just once?
        // simple debounce is enough.

        await presenceChannelRef.current.track({ user_id: currentUser.id, isTyping: true })

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(async () => {
            if (presenceChannelRef.current) {
                await presenceChannelRef.current.track({ user_id: currentUser.id, isTyping: false })
            }
        }, 1500)
    }

    const handleSend = async (overrideContent?: string) => {
        const content = overrideContent || inputText
        if (!content.trim()) return

        const tempId = `temp-${Date.now()}`
        const optimisticMsg: Message = {
            id: tempId,
            content: content,
            created_at: new Date().toISOString(),
            sender_id: currentUser.id,
            isOwn: true,
            isOptimistic: true,
            reply_to_id: replyingTo?.id,
            reply: replyingTo ? {
                id: replyingTo.id,
                content: replyingTo.content,
                sender_id: replyingTo.sender_id,
                profiles: { username: targetProfile.username || 'User' } // Approximate
            } : undefined
        }

        setMessages(prev => [...prev, optimisticMsg])
        if (!overrideContent) {
            setInputText('')
            setReplyingTo(null)
        }
        setTimeout(() => scrollToBottom('smooth'), 50)

        try {
            const result = await sendMessage(sessionId, content, replyingTo?.id)

            if (result.success && result.data) {
                setMessages(prev => prev.map(m => m.id === tempId ? {
                    ...m,
                    id: result.data.id,
                    created_at: result.data.created_at, // Use server time
                    isOptimistic: false
                } : m))

                // Cache
                db.chatMessages.put({
                    id: result.data.id,
                    session_id: sessionId,
                    sender_id: currentUser.id,
                    content: content,
                    created_at: result.data.created_at,
                    cached_at: Date.now()
                }).catch(() => { })
            } else {
                toast.error('Failed to send message')
                setMessages(prev => prev.filter(m => m.id !== tempId))
            }
        } catch (err) {
            console.error('Send error:', err)
            toast.error('Error sending message')
            setMessages(prev => prev.filter(m => m.id !== tempId))
        }
    }

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Photo is too large (max 5MB)")
            return
        }

        setIsUploading(true)
        const toastId = toast.loading("Uploading photo...")

        try {
            const formData = new FormData()
            formData.append('file', file)

            const result = await uploadDmPhoto(formData)
            if (result.success && result.url) {
                toast.success("Photo uploaded!", { id: toastId })
                await handleSend(`[IMG:${result.url}]`)
            } else {
                toast.error(result.error || "Upload failed", { id: toastId })
            }
        } catch (err) {
            toast.error("Error uploading photo", { id: toastId })
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleLoadMore = async () => {
        if (!hasMore || isLoadingMore || messages.length === 0) return

        setIsLoadingMore(true)
        const oldestMsg = messages[0]
        const currentScrollHeight = messagesContainerRef.current?.scrollHeight || 0
        const currentScrollTop = messagesContainerRef.current?.scrollTop || 0

        try {
            const result = await getSessionMessages(sessionId, oldestMsg.created_at, PAGE_SIZE)

            if (result.success && result.data && result.data.length > 0) {
                const newMsgs = result.data.map((m: any) => ({
                    id: m.id,
                    content: m.content,
                    created_at: m.created_at,
                    sender_id: m.sender_id,
                    isOwn: m.sender_id === currentUser.id,
                    isOptimistic: false
                }))

                setMessages(prev => [...newMsgs, ...prev])
                setHasMore(newMsgs.length >= PAGE_SIZE)

                // Cache
                const now = Date.now()
                db.chatMessages.bulkPut(
                    newMsgs.map(m => ({
                        id: m.id,
                        session_id: sessionId,
                        sender_id: m.sender_id,
                        content: m.content,
                        created_at: m.created_at,
                        cached_at: now
                    }))
                ).catch(() => { })

                // Restore scroll position
                // Wait for render
                setTimeout(() => {
                    if (messagesContainerRef.current) {
                        const newScrollHeight = messagesContainerRef.current.scrollHeight
                        messagesContainerRef.current.scrollTop = newScrollHeight - currentScrollHeight + currentScrollTop
                    }
                }, 0)
            } else {
                setHasMore(false)
            }
        } catch (err) {
            console.error('Load more error:', err)
            toast.error('Failed to load older messages')
        } finally {
            setIsLoadingMore(false)
        }
    }

    const lastReadMessageId = useMemo(() => {
        if (!lastReadByPartner) return null
        // Iterate backwards to find the latest own message that was read
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i]
            if (m.isOwn && !m.isOptimistic && new Date(m.created_at) <= lastReadByPartner) {
                return m.id
            }
        }
        return null
    }, [messages, lastReadByPartner])

    return (
        <div className="flex flex-col h-[100dvh] bg-neutral-950 text-neutral-200">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 bg-neutral-900/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between sticky top-0 z-10">
                {/* ... existing header ... */}
            </div>

            {/* Messages Area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 scroll-smooth">
                {isLoading ? (
                    <div className="flex flex-col gap-3 px-2 py-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                                <div className={`rounded-2xl ${i % 2 === 0 ? 'rounded-bl-none' : 'rounded-br-none'} animate-pulse ${i % 2 === 0 ? 'bg-neutral-800' : 'bg-purple-900/40'}`}
                                    style={{ width: `${40 + Math.random() * 35}%`, height: `${36 + (i % 3) * 14}px` }} />
                            </div>
                        ))}
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-600 space-y-4 opacity-100 animate-fade-in">
                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-2">
                            <MessageCircle size={48} className="text-purple-500/50" />
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="text-lg font-medium text-neutral-300">No messages yet</h3>
                            <p className="text-sm">Start the conversation with {targetProfile.username}!</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {hasMore && (
                            <div className="flex justify-center py-4">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-400 rounded-full transition-colors flex items-center gap-2"
                                >
                                    {isLoadingMore && <Loader2 size={12} className="animate-spin" />}
                                    Load previous messages
                                </button>
                            </div>
                        )}
                        {groupMessages(messages).map((msg, i, grouped) => {
                            const showDateSep = i === 0 ||
                                new Date(msg.created_at).toDateString() !== new Date(grouped[i - 1].created_at).toDateString()

                            const ownShape = msg.isLastInGroup ? 'rounded-br-none' : 'rounded-br-2xl'
                            const otherShape = msg.isLastInGroup ? 'rounded-bl-none' : 'rounded-bl-2xl'
                            const isImg = msg.content.startsWith('[IMG:')

                            return (
                                <div key={msg.id} className="relative group">
                                    {showDateSep && (
                                        <div className="flex items-center gap-3 my-4 opacity-60">
                                            <div className="flex-1 h-px bg-white/10" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                                                {formatDateSeparator(msg.created_at)}
                                            </span>
                                            <div className="flex-1 h-px bg-white/10" />
                                        </div>
                                    )}
                                    <motion.div
                                        drag="x"
                                        dragConstraints={{ left: 0, right: 0 }}
                                        dragElastic={{ right: 0.15 }}
                                        onDragEnd={(e, info) => {
                                            if (info.offset.x > 50) {
                                                setReplyingTo(msg)
                                            }
                                        }}
                                        className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'} ${msg.isFirstInGroup ? 'mt-3' : 'mt-0.5'} relative z-10 touch-pan-y`}
                                    >
                                        <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl text-[15px] leading-relaxed shadow-md transition-all ${msg.isOwn
                                            ? `bg-gradient-to-br from-purple-600 to-indigo-600 text-white ${ownShape}`
                                            : `bg-neutral-800 text-neutral-200 ${otherShape} border border-white/5`
                                            } ${isImg ? 'p-1.5' : 'px-5 py-3'}`}>

                                            {/* Reply Context */}
                                            {msg.reply && (
                                                <div className={`text-xs mb-2 pl-2 border-l-2 ${msg.isOwn ? 'border-white/30 text-white/70' : 'border-purple-500 text-neutral-400'}`}>
                                                    <div className="font-bold opacity-80 mb-0.5">
                                                        {msg.reply.sender_id === currentUser.id ? 'You' : msg.reply.profiles?.username || 'User'}
                                                    </div>
                                                    <div className="truncate opacity-70 italic">
                                                        {msg.reply.content.startsWith('[IMG:') ? '📷 Photo' : msg.reply.content}
                                                    </div>
                                                </div>
                                            )}

                                            {isImg ? (
                                                <img
                                                    src={msg.content.match(/\[IMG:(.*)\]/)?.[1]}
                                                    alt="Shared photo"
                                                    className="rounded-xl w-full h-auto max-h-[300px] object-cover cursor-pointer"
                                                    onClick={() => window.open(msg.content.match(/\[IMG:(.*)\]/)?.[1], '_blank')}
                                                />
                                            ) : (
                                                <p className="font-medium whitespace-pre-wrap">{msg.content}</p>
                                            )}

                                            {msg.isLastInGroup && (
                                                <div className={`flex items-center justify-end gap-1.5 mt-1.5 ${msg.isOwn ? 'text-purple-200/60' : 'text-neutral-500'}`}>
                                                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {msg.isOwn && (
                                                        <span className="text-[11px] ml-0.5 font-bold">
                                                            {msg.isOptimistic ? '···' : '✓'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>

                                    {/* Swipe Indicator */}
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
                                        <Reply size={16} />
                                    </div>

                                    {/* Read Receipt Avatar */}
                                    {msg.id === lastReadMessageId && (
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="flex justify-end mt-1 mr-1"
                                        >
                                            <div className="w-3.5 h-3.5 rounded-full bg-purple-600 border border-neutral-950 flex items-center justify-center text-[8px] font-bold text-white shadow-sm ring-2 ring-neutral-950">
                                                {targetProfile.username?.[0]?.toUpperCase()}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            )
                        })}
                    </>
                )}

                {/* Typing Indicator */}
                <AnimatePresence>
                    {typingUsers.size > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex justify-start px-5 mt-2 mb-1"
                        >
                            <div className="bg-neutral-800 border border-white/5 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1.5 min-w-[60px]">
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 bg-neutral-900 border-t border-white/5 pb-10 sm:pb-6 relative z-20">
                <AnimatePresence>
                    {replyingTo && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-4 pt-3"
                        >
                            <div className="flex items-center justify-between bg-neutral-800/50 rounded-xl p-3 border-l-4 border-purple-500">
                                <div className="flex flex-col text-sm overflow-hidden">
                                    <span className="text-purple-400 font-medium text-xs mb-0.5">
                                        Replying to {replyingTo.isOwn ? 'Yourself' : targetProfile.username}
                                    </span>
                                    <span className="text-neutral-300 truncate">
                                        {replyingTo.content.startsWith('[IMG:') ? '📷 Photo' : replyingTo.content}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setReplyingTo(null)}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X size={16} className="text-neutral-400" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="p-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                    />

                    <div className="flex items-end gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="p-3.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full transition-all active:scale-90 border border-white/5 mb-0.5"
                        >
                            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={22} />}
                        </button>

                        <div className="flex-1 flex items-end gap-3 bg-neutral-800/50 rounded-[2rem] p-2 border border-white/10 focus-within:border-purple-500/50 focus-within:ring-4 focus-within:ring-purple-500/10 transition-all shadow-inner">
                            <textarea
                                value={inputText}
                                onChange={(e) => {
                                    setInputText(e.target.value)
                                    handleTyping()
                                }}
                                onKeyDown={handleKeyPress}
                                placeholder="Message..."
                                className="flex-1 bg-transparent text-neutral-100 text-[16px] resize-none focus:outline-none max-h-32 py-3 px-5 min-h-[48px] custom-scrollbar"
                                rows={1}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!inputText.trim()}
                                className="p-3.5 bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full disabled:opacity-30 transition-all active:scale-90 shadow-xl shadow-purple-900/40 flex-shrink-0"
                            >
                                <Send size={20} className="ml-0.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


