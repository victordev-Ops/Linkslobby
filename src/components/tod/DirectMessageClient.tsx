'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Loader2, MessageCircle, Image as ImageIcon, Camera, Plus, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { sendDirectMessage } from '@/actions/direct-messages'
import { uploadDmPhoto } from '@/actions/dm-photos'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DirectMessageClientProps {
    targetUserId: string
    targetUsername: string // Passed from server page for immediate render
}

interface Message {
    id: string
    content: string
    created_at: string
    isOwn: boolean
    isOptimistic?: boolean
    isRead?: boolean
}

const PAGE_SIZE = 10

// Helper to extract sender ID from message
// Matches [DM:uuid...] and captures the uuid
const getSenderId = (content: string) => {
    const match = content.match(/^\[DM:([a-f0-9-]+)/);
    return match ? match[1] : null;
}

// Helper to clean message - strips [DM:...] tag
const cleanMessage = (content: string) => content.replace(/^\[DM:[^\]]+\]\s*/, '');

export default function DirectMessageClient({ targetUserId, targetUsername }: DirectMessageClientProps) {
    const { profile } = useAuth()
    const router = useRouter()
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingOlder, setIsLoadingOlder] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const initialScrollDone = useRef(false)

    // Typing State
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const supabase = useMemo(() => createClient(), [])

    // Scroll to bottom helper
    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior })
    }

    // Fetch messages with pagination (loads newest first, then reverses for display)
    const fetchMessages = useCallback(async (offset: number, prepend = false) => {
        if (!profile?.id) return null

        const { data: allMessages, error } = await supabase
            .from('confessions')
            .select('id, message, created_at, profile_id, is_read')
            .in('profile_id', [profile.id, targetUserId])
            .eq('message_type', 'confession')
            .like('message', '[DM:%')
            .order('created_at', { ascending: false })
            .range(offset, offset + PAGE_SIZE * 3 - 1) // Fetch more from DB since we filter client-side

        if (error || !allMessages) return null

        const filtered = allMessages.filter(m => {
            const senderId = getSenderId(m.message);
            const isReceived = m.profile_id === profile.id && senderId === targetUserId;
            const isSent = m.profile_id === targetUserId && senderId === profile.id;
            return isReceived || isSent;
        }).map(m => ({
            id: m.id,
            content: cleanMessage(m.message),
            created_at: m.created_at,
            isOwn: m.profile_id === targetUserId,
            isRead: m.is_read
        }))

        // Reverse to chronological order (oldest first for display)
        filtered.reverse()

        return { filtered, rawCount: allMessages.length }
    }, [profile?.id, targetUserId, supabase])

    // Initial Fetch & Subscription
    useEffect(() => {
        if (!profile?.id) return

        const loadInitial = async () => {
            setIsLoading(true)

            const result = await fetchMessages(0)
            if (!result) { setIsLoading(false); return }

            const { filtered, rawCount } = result

            // Take only the last PAGE_SIZE messages for initial display
            const initialMessages = filtered.slice(-PAGE_SIZE)
            setMessages(initialMessages)
            setHasMore(filtered.length > PAGE_SIZE || rawCount >= PAGE_SIZE * 3)

            // Mark unread received messages as read
            const unreadToMark = filtered
                .filter(m => !m.isOwn && !m.isRead)
                .map(m => m.id)

            if (unreadToMark.length > 0) {
                supabase.rpc('mark_confessions_read', { confession_ids: unreadToMark })
                    .catch(async () => {
                        for (const id of unreadToMark) {
                            await supabase.from('confessions').update({ is_read: true }).eq('id', id);
                        }
                    });
            }

            setIsLoading(false)
            // Scroll to bottom after initial load
            setTimeout(() => scrollToBottom('instant'), 50)
            initialScrollDone.current = true
        }

        loadInitial()

        // Realtime Subscription for Messages
        const msgChannel = supabase
            .channel(`dm-chat-${profile.id}-${targetUserId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'confessions',
                filter: `profile_id=in.(${profile.id},${targetUserId})`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new;
                    const senderId = getSenderId(newMsg.message);

                    const isReceived = newMsg.profile_id === profile.id && senderId === targetUserId;
                    const isSent = newMsg.profile_id === targetUserId && senderId === profile.id;

                    if (isReceived || isSent) {
                        const msg: Message = {
                            id: newMsg.id,
                            content: cleanMessage(newMsg.message),
                            created_at: newMsg.created_at,
                            isOwn: isSent,
                            isRead: newMsg.is_read
                        }
                        setMessages(prev => {
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg];
                        })
                        setTimeout(scrollToBottom, 100)

                        if (isReceived) {
                            supabase.from('confessions').update({ is_read: true }).eq('id', newMsg.id).then();
                        }
                    }
                } else if (payload.eventType === 'UPDATE') {
                    const updated = payload.new;
                    setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, isRead: updated.is_read } : m));
                }
            })
            .subscribe()

        // Presence Channel for Typing
        const presenceChannel = supabase.channel(`dm-presence-${[profile.id, targetUserId].sort().join('-')}`)
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                const typing = new Set<string>();
                Object.values(state).forEach((p: any) => {
                    p.forEach((u: any) => {
                        if (u.isTyping && u.user_id !== profile.id) {
                            typing.add(u.user_id);
                        }
                    })
                });
                setTypingUsers(typing);
                if (typing.size > 0) setTimeout(scrollToBottom, 50);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({ user_id: profile.id, isTyping: false });
                }
            });

        return () => {
            supabase.removeChannel(msgChannel)
            supabase.removeChannel(presenceChannel)
        }
    }, [profile?.id, targetUserId, supabase])

    // Load older messages on scroll-up
    const loadOlderMessages = useCallback(async () => {
        if (isLoadingOlder || !hasMore || !profile?.id) return

        setIsLoadingOlder(true)
        const container = messagesContainerRef.current
        const prevScrollHeight = container?.scrollHeight || 0

        // We need to figure out how many raw rows to skip
        // Use the oldest message's created_at as a cursor
        const oldestMsg = messages[0]
        if (!oldestMsg) { setIsLoadingOlder(false); return }

        try {
            const { data: olderRaw, error } = await supabase
                .from('confessions')
                .select('id, message, created_at, profile_id, is_read')
                .in('profile_id', [profile.id, targetUserId])
                .eq('message_type', 'confession')
                .like('message', '[DM:%')
                .lt('created_at', oldestMsg.created_at)
                .order('created_at', { ascending: false })
                .limit(PAGE_SIZE * 3)

            if (error || !olderRaw) {
                setIsLoadingOlder(false)
                return
            }

            const filtered = olderRaw.filter(m => {
                const senderId = getSenderId(m.message);
                const isReceived = m.profile_id === profile.id && senderId === targetUserId;
                const isSent = m.profile_id === targetUserId && senderId === profile.id;
                return isReceived || isSent;
            }).map(m => ({
                id: m.id,
                content: cleanMessage(m.message),
                created_at: m.created_at,
                isOwn: m.profile_id === targetUserId,
                isRead: m.is_read
            }))

            // Reverse to chronological order
            filtered.reverse()

            // Take last PAGE_SIZE
            const olderMessages = filtered.slice(-PAGE_SIZE)

            if (olderMessages.length === 0) {
                setHasMore(false)
                setIsLoadingOlder(false)
                return
            }

            // Prepend older messages
            setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id))
                const newOnes = olderMessages.filter(m => !existingIds.has(m.id))
                return [...newOnes, ...prev]
            })

            setHasMore(olderMessages.length >= PAGE_SIZE)

            // Preserve scroll position after prepending
            requestAnimationFrame(() => {
                if (container) {
                    const newScrollHeight = container.scrollHeight
                    container.scrollTop = newScrollHeight - prevScrollHeight
                }
            })
        } catch (err) {
            console.error('Error loading older messages:', err)
        } finally {
            setIsLoadingOlder(false)
        }
    }, [isLoadingOlder, hasMore, messages, profile?.id, targetUserId, supabase])

    // Scroll-up detection
    useEffect(() => {
        const container = messagesContainerRef.current
        if (!container) return

        const handleScroll = () => {
            // When scrolled near the top, load older messages
            if (container.scrollTop < 80 && hasMore && !isLoadingOlder && initialScrollDone.current) {
                loadOlderMessages()
            }
        }

        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [hasMore, isLoadingOlder, loadOlderMessages])

    const handleTyping = async () => {
        const presenceChannel = supabase.channel(`dm-presence-${[profile!.id, targetUserId].sort().join('-')}`);
        await presenceChannel.track({ user_id: profile!.id, isTyping: true });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(async () => {
            await presenceChannel.track({ user_id: profile!.id, isTyping: false });
        }, 1500);
    }

    const handleSend = async (overrideContent?: string) => {
        const content = overrideContent || inputText
        if (!content.trim()) return

        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const optimisticMsg: Message = {
            id: tempId,
            content: content,
            created_at: new Date().toISOString(),
            isOwn: true,
            isOptimistic: true
        }

        setMessages(prev => [...prev, optimisticMsg])
        if (!overrideContent) setInputText('')

        setTimeout(scrollToBottom, 50)

        try {
            const result = await sendDirectMessage(targetUserId, content)

            if (result.success && result.id) {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: result.id!, isOptimistic: false } : m))
            } else {
                console.error("Failed to send:", result.error)
                toast.error("Failed to send message")
                setMessages(prev => prev.filter(m => m.id !== tempId))
            }
        } catch (err) {
            console.error("Exception sending message:", err)
            toast.error("Error sending message")
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

    if (!profile) return null

    return (
        <div className="flex flex-col h-[100dvh] bg-neutral-950 text-neutral-200">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 bg-neutral-900/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link
                        href="/inbox"
                        className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors text-neutral-400 hover:text-white"
                    >
                        <ArrowLeft size={24} />
                    </Link>

                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center text-white font-black text-xl shadow-lg ring-2 ring-white/10">
                            {targetUsername.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="font-black text-white text-lg tracking-tight leading-none">
                                {targetUsername}
                            </h1>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-widest">
                                    Active Now
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                {/* Load Older Messages Indicator */}
                {!isLoading && hasMore && (
                    <div className="flex justify-center py-2">
                        {isLoadingOlder ? (
                            <Loader2 size={18} className="text-neutral-500 animate-spin" />
                        ) : (
                            <button
                                onClick={loadOlderMessages}
                                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 active:scale-95"
                            >
                                <ChevronUp size={14} />
                                Load older messages
                            </button>
                        )}
                    </div>
                )}

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
                            <p className="text-sm">Start the conversation with {targetUsername}!</p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                        >
                            <div
                                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-5 py-3 text-[15px] leading-relaxed shadow-md transition-all ${msg.isOwn
                                    ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-br-none'
                                    : 'bg-neutral-800 text-neutral-200 rounded-bl-none border border-white/5'
                                    } ${msg.content.startsWith('[IMG:') ? 'p-1.5' : ''}`}
                            >
                                {msg.content.startsWith('[IMG:') ? (
                                    <div className="relative group">
                                        <img
                                            src={msg.content.match(/\[IMG:(.*)\]/)?.[1]}
                                            alt="Shared photo"
                                            className="rounded-xl w-full h-auto max-h-[300px] object-cover cursor-pointer"
                                            onClick={() => window.open(msg.content.match(/\[IMG:(.*)\]/)?.[1], '_blank')}
                                        />
                                    </div>
                                ) : (
                                    <p className="font-medium">{msg.content}</p>
                                )}
                                <div className={`flex items-center justify-end gap-1.5 mt-2 ${msg.isOwn ? 'text-purple-200/60' : 'text-neutral-500'}`}>
                                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {msg.isOwn && (
                                        <span className={`text-[11px] ml-1 font-bold ${msg.isRead ? 'text-blue-400' : ''}`}>
                                            {msg.isOptimistic ? '...' : msg.isRead ? '✓✓' : '✓'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {typingUsers.size > 0 && (
                    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300 px-5">
                        <div className="bg-neutral-800 rounded-2xl rounded-bl-none px-4 py-3">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 p-4 bg-neutral-900 border-t border-white/5 pb-10 sm:pb-6">
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
    )
}
