'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Loader2, MessageCircle, Plus, ChevronUp, X, Reply, MoreVertical, Ban, Flag, Trash2 } from 'lucide-react'
import VerifiedBadge from '@/components/VerifiedBadge'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { RealtimeChannel } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { sendMessage, sendMessageToUser, getSessionMessages, markSessionRead, clearChat, reportChatUser } from '@/actions/chat'
import { blockUser } from '@/actions/blocked-users'
import { uploadDmPhoto } from '@/actions/dm-photos'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { compressImage } from '@/lib/image-utils'
import { useNotifications } from '@/context/NotificationContext'
// import { queueOfflineAction } from '@/lib/sync' // TODO: Update sync for chat_messages

interface DirectMessageClientProps {
    sessionId: string | null
    isDraft?: boolean
    currentUser: { id: string, email?: string }
    targetProfile: {
        id: string
        username: string | null
        avatar_url?: string | null
        is_pro?: boolean
        slug?: string | null
        is_deactivated?: boolean
        dms_disabled?: boolean
    }
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
// Annotate messages with group metadata for messenger-style rendering
function groupMessages(msgs: Message[]): Message[] {
    return msgs.map((msg, i) => {
        const prev = msgs[i - 1]
        const next = msgs[i + 1]

        // Only break groups on sender change or time gap.
        // Replies stay in their sender's group — the reply context bar provides distinction.
        const isFirstInGroup = !prev ||
            prev.isOwn !== msg.isOwn ||
            (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 2 * 60 * 1000)

        const isLastInGroup = !next ||
            next.isOwn !== msg.isOwn ||
            (new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() > 2 * 60 * 1000)

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

export default function DirectMessageClient({ sessionId: initialSessionId, isDraft = false, currentUser, targetProfile }: DirectMessageClientProps) {
    const router = useRouter()
    const notifications = useNotifications()
    // In draft mode sessionId starts as null — nothing is persisted until the
    // first message is sent. sendMessageToUser() atomically creates the
    // session + inserts the message, and we adopt the returned sessionId here.
    const [sessionId, setSessionId] = useState<string | null>(initialSessionId)
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const sentinelRef = useRef<HTMLDivElement>(null)
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
    const [showMenu, setShowMenu] = useState(false)
    const [isPartnerOnline, setIsPartnerOnline] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Scroll to bottom helper
    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior })
    }

    // Initial Fetch & Subscription
    useEffect(() => {
        // Draft sessions have nothing to fetch or subscribe to yet — there's
        // no session row until the first message is sent.
        if (!sessionId) {
            setIsLoading(false)
            return
        }
        // Lock in a non-null alias for use inside nested closures below.
        const sid = sessionId

        const loadInitial = async () => {
            setIsLoading(true)

            // 1. Load cached messages from Dexie first (load last 20)
            try {
                const cached = await db.chatMessages
                    .where('session_id')
                    .equals(sid)
                    .sortBy('created_at')

                // Only take last 20 from cache for initial render
                const recentCached = cached.slice(-PAGE_SIZE)

                if (recentCached.length > 0) {
                    const cachedMsgs = recentCached.map(m => {
                        const replyData = m.metadata?.reply
                        if (replyData && Array.isArray(replyData.profiles)) {
                            replyData.profiles = replyData.profiles[0]
                        }

                        return {
                            id: m.id,
                            content: m.content || '',
                            created_at: m.created_at,
                            sender_id: m.sender_id,
                            isOwn: m.sender_id === currentUser.id,
                            isOptimistic: false,
                            reply_to_id: m.metadata?.reply_to_id,
                            reply: replyData
                        }
                    })
                    setMessages(cachedMsgs)
                    setIsLoading(false) // Hide skeleton immediately if we have cached messages
                    setTimeout(() => scrollToBottom('instant'), 50)
                }
            } catch { }

            // 2. Fetch from Server Action (Limit 20)
            const result = await getSessionMessages(sid, undefined, PAGE_SIZE)

            if (result.success && result.data) {
                const serverMsgs = result.data.map((m: any) => {
                    const replyData = m.reply
                    if (replyData && Array.isArray(replyData.profiles)) {
                        replyData.profiles = replyData.profiles[0]
                    }

                    return {
                        id: m.id,
                        content: m.content || '',
                        created_at: m.created_at,
                        sender_id: m.sender_id,
                        isOwn: m.sender_id === currentUser.id,
                        isOptimistic: false,
                        reply_to_id: m.reply_to_id,
                        reply: replyData
                    }
                })

                setMessages(serverMsgs)
                setHasMore(serverMsgs.length >= PAGE_SIZE)

                const now = Date.now()
                db.chatMessages.bulkPut(
                    serverMsgs.map(m => ({
                        id: m.id,
                        session_id: sid,
                        sender_id: m.sender_id,
                        content: m.content,
                        created_at: m.created_at,
                        cached_at: now,
                        metadata: {
                            reply_to_id: m.reply_to_id,
                            reply: m.reply
                        }
                    }))
                ).catch(() => { })

                // Mark session as read and refresh badge
                markSessionRead(sid).then(() => notifications.refreshUnreadCount()).catch(console.error)

                // Fetch partner's last read time
                const { data: partnerPart } = await supabase
                    .from('chat_participants')
                    .select('last_read_at')
                    .eq('session_id', sid)
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
            .channel(`chat-session-${sid}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `session_id=eq.${sid}`
            }, (payload) => {
                const newMsg = payload.new

                // Avoid redundant add if we sent it
                // We rely on temp ID replacement or duplicates check
                // Here we just check ID
                // Side effects
                if (newMsg.sender_id !== currentUser.id) {
                    markSessionRead(sid).then(() => notifications.refreshUnreadCount()).catch(() => { })
                }
                setTimeout(() => scrollToBottom('smooth'), 100)

                setMessages(prev => {
                    // Check if the message already exists (by ID)
                    if (prev.some(m => m.id === newMsg.id)) return prev

                    // Check if we have an optimistic message that roughly matches (same content, sender, and recent)
                    // This creates a smoother transition if the temp ID hasn't been swapped yet.
                    // Trim both sides — the server trims content before persisting, so an
                    // untrimmed optimistic bubble would otherwise fail to match and get
                    // appended as a second, duplicate message instead of being replaced.
                    const existingOptimisticIndex = prev.findIndex(m =>
                        m.isOptimistic &&
                        m.sender_id === newMsg.sender_id &&
                        m.content?.trim() === newMsg.content?.trim()
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
                                content: parent.content || '',
                                sender_id: parent.sender_id,
                                profiles: { username: (parent.isOwn ? 'You' : targetProfile.username) || 'User' }
                            }
                        }
                    }

                    const newMessageObj: Message = {
                        id: newMsg.id,
                        content: newMsg.content || '',
                        created_at: newMsg.created_at,
                        sender_id: newMsg.sender_id,
                        isOwn: isOwn,
                        isOptimistic: false,
                        reply_to_id: newMsg.reply_to_id,
                        reply: replyData
                    }

                    // Cache in Dexie
                    db.chatMessages.put({
                        id: newMsg.id,
                        session_id: sid,
                        sender_id: newMsg.sender_id,
                        content: newMsg.content,
                        created_at: newMsg.created_at,
                        cached_at: Date.now(),
                        metadata: {
                            reply_to_id: newMsg.reply_to_id,
                            reply: replyData
                        }
                    }).catch(() => { })

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

        const presenceChannel = supabase.channel(`chat-presence-${sid}`)
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
                    await presenceChannel.track({ user_id: currentUser.id, isTyping: false, online: true })
                }
            })

        // Track partner online status from presence state
        presenceChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
            const partnerOnline = newPresences?.some((p: any) => p.user_id === targetProfile.id)
            if (partnerOnline) setIsPartnerOnline(true)
        })
        presenceChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            const partnerLeft = leftPresences?.some((p: any) => p.user_id === targetProfile.id)
            if (partnerLeft) setIsPartnerOnline(false)
        })

        const readReceiptChannel = supabase
            .channel(`chat-read-${sid}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'chat_participants',
                filter: `session_id=eq.${sid}`
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
    }, [sessionId, currentUser.id, supabase, notifications])

    // IntersectionObserver for infinite scroll (load older messages on scroll up)
    useEffect(() => {
        if (!sessionId || !sentinelRef.current || isLoading) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore && initialScrollDone.current) {
                    handleLoadMore()
                }
            },
            { root: messagesContainerRef.current, threshold: 0.1 }
        )

        observer.observe(sentinelRef.current)
        return () => observer.disconnect()
    }, [sessionId, hasMore, isLoadingMore, isLoading])

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

        // Draft mode: no session exists yet. The first send is the only
        // moment a session gets created — sendMessageToUser() atomically
        // does get-or-create-session + block-check + insert in one call.
        if (!sessionId) {
            const trimmedContent = content.trim()
            const tempId = `temp-${Date.now()}`
            const optimisticMsg: Message = {
                id: tempId,
                content: trimmedContent,
                created_at: new Date().toISOString(),
                sender_id: currentUser.id,
                isOwn: true,
                isOptimistic: true,
            }

            setMessages(prev => [...prev, optimisticMsg])
            if (!overrideContent) setInputText('')
            setReplyingTo(null)
            setTimeout(() => scrollToBottom('smooth'), 50)

            try {
                const result = await sendMessageToUser(targetProfile.id, content)

                if (result.success && result.sessionId && result.data) {
                    setMessages(prev => prev.map(m => m.id === tempId ? {
                        ...m,
                        id: result.data.id,
                        created_at: result.data.created_at,
                        isOptimistic: false
                    } : m))

                    db.chatMessages.put({
                        id: result.data.id,
                        session_id: result.sessionId,
                        sender_id: currentUser.id,
                        content: trimmedContent,
                        created_at: result.data.created_at,
                        cached_at: Date.now(),
                        metadata: {}
                    }).catch(() => { })

                    // Adopt the real session: this flips every guarded effect
                    // above (fetch, realtime, infinite scroll) from dormant
                    // to active, and swaps the URL without a remount.
                    setSessionId(result.sessionId)
                    router.replace(`/messages/${result.sessionId}`, { scroll: false })
                    notifications.refreshUnreadCount()
                } else {
                    toast.error(result.message || 'Failed to send message')
                    setMessages(prev => prev.filter(m => m.id !== tempId))
                }
            } catch (err) {
                console.error('Send error:', err)
                toast.error('Error sending message')
                setMessages(prev => prev.filter(m => m.id !== tempId))
            }
            return
        }

        const trimmedContent = content.trim()
        const tempId = `temp-${Date.now()}`
        const optimisticMsg: Message = {
            id: tempId,
            content: trimmedContent,
            created_at: new Date().toISOString(),
            sender_id: currentUser.id,
            isOwn: true,
            isOptimistic: true,
            reply_to_id: replyingTo?.id,
            reply: replyingTo ? {
                id: replyingTo.id,
                content: replyingTo.content || '',
                sender_id: replyingTo.sender_id,
                profiles: { username: replyingTo.isOwn ? 'You' : (targetProfile.username || 'User') }
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
                setMessages(prev => {
                    // The realtime INSERT handler can beat this response back and
                    // already have replaced the temp bubble with the real message
                    // (same id). If so, just drop the leftover temp bubble instead
                    // of mapping it onto the same id a second time — that's what
                    // was producing the duplicate.
                    if (prev.some(m => m.id === result.data.id && !m.isOptimistic)) {
                        return prev.filter(m => m.id !== tempId)
                    }
                    return prev.map(m => m.id === tempId ? {
                        ...m,
                        id: result.data.id,
                        created_at: result.data.created_at, // Use server time
                        isOptimistic: false
                    } : m)
                })

                // Cache
                db.chatMessages.put({
                    id: result.data.id,
                    session_id: sessionId,
                    sender_id: currentUser.id,
                    content: trimmedContent,
                    created_at: result.data.created_at,
                    cached_at: Date.now(),
                    metadata: {
                        reply_to_id: replyingTo?.id,
                        reply: replyingTo ? {
                            id: replyingTo.id,
                            content: replyingTo.content || '',
                            sender_id: replyingTo.sender_id,
                            profiles: { username: replyingTo.isOwn ? 'You' : (targetProfile.username || 'User') }
                        } : undefined
                    }
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

        // uploadDmPhoto requires an existing session it can verify the caller
        // is a participant of — nothing to attach to yet in draft mode. Send
        // a text message first to create the session, then photos work.
        if (!sessionId) {
            toast.error("Send a message first to start the conversation")
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Photo is too large (max 5MB)")
            return
        }

        setIsUploading(true)
        const toastId = toast.loading("Uploading photo...")

        try {
            // Compress image before upload
            const optimizedFile = await compressImage(file)

            const formData = new FormData()
            formData.append('file', optimizedFile)

            const result = await uploadDmPhoto(sessionId, formData)
            if (result.success && result.url) {
                toast.success("Photo uploaded!", { id: toastId })
                await handleSend(`[IMG:${result.url}]`)
            } else {
                toast.error(result.error || "Upload failed", { id: toastId })
            }
        } catch (err) {
            console.error('Photo upload error:', err)
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
        if (!sessionId || !hasMore || isLoadingMore || messages.length === 0) return

        setIsLoadingMore(true)
        const oldestMsg = messages[0]
        const currentScrollHeight = messagesContainerRef.current?.scrollHeight || 0
        const currentScrollTop = messagesContainerRef.current?.scrollTop || 0

        try {
            const result = await getSessionMessages(sessionId, oldestMsg.created_at, PAGE_SIZE)

            if (result.success && result.data && result.data.length > 0) {
                const newMsgs = result.data.map((m: any) => {
                    const replyData = m.reply
                    if (replyData && Array.isArray(replyData.profiles)) {
                        replyData.profiles = replyData.profiles[0]
                    }

                    return {
                        id: m.id,
                        content: m.content || '',
                        created_at: m.created_at,
                        sender_id: m.sender_id,
                        isOwn: m.sender_id === currentUser.id,
                        isOptimistic: false,
                        reply_to_id: m.reply_to_id,
                        reply: replyData
                    }
                })

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
                        cached_at: now,
                        metadata: {
                            reply_to_id: m.reply_to_id,
                            reply: m.reply
                        }
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

    const composerDisabled = Boolean(targetProfile.is_deactivated || targetProfile.dms_disabled)

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
        <div className="flex flex-col h-[100dvh] bg-neutral-950 text-neutral-200 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 bg-neutral-900/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/inbox')}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-white"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <button
                        onClick={() => router.push(`/u/${targetProfile.slug || targetProfile.username}`)}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                        {targetProfile.avatar_url ? (
                            <img
                                src={targetProfile.avatar_url}
                                alt={targetProfile.username || 'User'}
                                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10 shadow-lg"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-900/20">
                                {targetProfile.username?.[0]?.toUpperCase() || '?'}
                            </div>
                        )}
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                                <span className="font-bold text-sm leading-tight text-neutral-100">
                                    @{targetProfile.username || 'user'}
                                </span>
                                {targetProfile.is_pro && <VerifiedBadge size={14} />}
                            </div>
                            <div className="flex items-center gap-1.5">
                                {targetProfile.is_deactivated ? (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Unavailable</span>
                                ) : (
                                    <>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isPartnerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`} />
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isPartnerOnline ? 'text-emerald-500/80' : 'text-neutral-600'}`}>{isPartnerOnline ? 'Online' : 'Offline'}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </button>
                </div>
                <div className="flex items-center gap-1 relative" ref={menuRef}>
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-white"
                    >
                        <MoreVertical size={20} />
                    </button>
                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                                className="absolute right-0 top-full mt-1 w-48 bg-neutral-800 border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden"
                            >
                                <button
                                    onClick={async () => {
                                        setShowMenu(false)
                                        if (!confirm(`Block @${targetProfile.username}?`)) return
                                        try {
                                            await blockUser(targetProfile.id)
                                            toast.success(`Blocked @${targetProfile.username}`)
                                            router.push('/inbox')
                                        } catch { toast.error('Failed to block user') }
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors"
                                >
                                    <Ban size={16} /> Block User
                                </button>
                                {sessionId && (
                                    <button
                                        onClick={async () => {
                                            setShowMenu(false)
                                            const reason = prompt('Report reason (optional):')
                                            if (reason === null) return
                                            try {
                                                const result = await reportChatUser(sessionId, reason || 'No reason provided')
                                                if (result.success) toast.success('Report submitted')
                                                else toast.error(result.message || 'Failed to report')
                                            } catch { toast.error('Failed to submit report') }
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-amber-400 hover:bg-white/5 transition-colors"
                                    >
                                        <Flag size={16} /> Report User
                                    </button>
                                )}
                                {sessionId && (
                                    <>
                                        <div className="h-px bg-white/5" />
                                        <button
                                            onClick={async () => {
                                                setShowMenu(false)
                                                if (!confirm('Clear all messages in this chat?')) return
                                                try {
                                                    const result = await clearChat(sessionId)
                                                    if (result.success) {
                                                        setMessages([])
                                                        toast.success('Chat cleared')
                                                        // The server clear only hides messages before a
                                                        // cutoff for this user — it doesn't touch our local
                                                        // Dexie cache. Without this, the next load renders
                                                        // the stale cached messages for a moment before the
                                                        // clear-aware server fetch overwrites them.
                                                        db.chatMessages
                                                            .where('session_id')
                                                            .equals(sessionId)
                                                            .delete()
                                                            .catch(() => { })
                                                    } else toast.error(result.message || 'Failed to clear chat')
                                                } catch { toast.error('Failed to clear chat') }
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-300 hover:bg-white/5 transition-colors"
                                        >
                                            <Trash2 size={16} /> Clear Chat
                                        </button>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto overscroll-contain p-4 pb-2 scroll-smooth custom-scrollbar"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
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
                            {targetProfile.is_deactivated ? (
                                <p className="text-sm">This account is no longer available.</p>
                            ) : isDraft ? (
                                <>
                                    <h3 className="text-lg font-medium text-neutral-300">Say hello to @{targetProfile.username || 'this user'} 👋</h3>
                                    <p className="text-sm">Nothing is sent or saved until you hit send.</p>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-lg font-medium text-neutral-300">No messages yet</h3>
                                    <p className="text-sm">Start the conversation with {targetProfile.username}!</p>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Infinite scroll sentinel */}
                        <div ref={sentinelRef} className="h-1" />
                        {isLoadingMore && (
                            <div className="flex justify-center py-3">
                                <Loader2 size={16} className="animate-spin text-purple-400" />
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
                                            {msg.reply && msg.reply.content !== undefined && (
                                                <div 
                                                    onClick={() => {
                                                        // Fallback feature: find index of replied message and scroll up
                                                        const el = document.getElementById(`msg-${msg.reply?.id}`)
                                                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                    }}
                                                    className={`cursor-pointer text-xs mb-2 pl-2.5 py-1 border-l-2 ${msg.isOwn ? 'border-white/40 text-white/80 bg-black/10' : 'border-purple-500 text-neutral-300 bg-black/20'} rounded-r-md transition-colors hover:opacity-80`}
                                                >
                                                    <div className="font-bold opacity-90 mb-0.5 text-[11px] uppercase tracking-wider">
                                                        {msg.reply.sender_id === currentUser.id ? 'You' : (msg.reply.profiles as any)?.username || 'User'}
                                                    </div>
                                                    <div className="truncate opacity-80 italic">
                                                        {msg.reply.content?.startsWith('[IMG:') ? '📷 Photo' : msg.reply.content}
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

                                    {/* Swipe Indicator - Only for other's messages for now to avoid clutter */}
                                    {!msg.isOwn && (
                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-500 z-0 scale-75">
                                            <Reply size={20} />
                                        </div>
                                    )}

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
            <div className="flex-shrink-0 bg-neutral-900/95 backdrop-blur-md border-t border-white/5 safe-area-bottom">
                <AnimatePresence>
                    {replyingTo && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-4 pt-3"
                        >
                            <div className="flex items-center justify-between bg-neutral-800/80 rounded-xl p-3 border-l-4 border-purple-500 shadow-lg">
                                <div className="flex flex-col text-sm overflow-hidden">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <Reply size={12} className="text-purple-400" />
                                        <span className="text-purple-400 font-bold text-[10px] uppercase tracking-wider">
                                            Replying to {replyingTo.isOwn ? 'Yourself' : `@${targetProfile.username}`}
                                        </span>
                                    </div>
                                    <span className="text-neutral-300 truncate text-xs opacity-80">
                                        {replyingTo.content?.startsWith('[IMG:') ? '📷 Photo' : replyingTo.content}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setReplyingTo(null)}
                                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X size={14} className="text-neutral-500" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="p-3 sm:p-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                    />

                    <div className="flex items-end gap-2 max-w-5xl mx-auto">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || composerDisabled || !sessionId}
                            title={!sessionId ? 'Send a message first to attach photos' : undefined}
                            className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full transition-all active:scale-95 border border-white/5 mb-1 shadow-lg disabled:opacity-30"
                        >
                            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={22} />}
                        </button>

                        <div className="flex-1 flex items-end gap-2 bg-neutral-800/50 rounded-3xl p-1.5 border border-white/10 focus-within:border-purple-500/50 focus-within:ring-4 focus-within:ring-purple-500/10 transition-all shadow-inner">
                            <textarea
                                value={inputText}
                                onChange={(e) => {
                                    setInputText(e.target.value)
                                    handleTyping()
                                }}
                                onKeyDown={handleKeyPress}
                                placeholder={composerDisabled ? 'Messaging unavailable' : 'Message...'}
                                disabled={composerDisabled}
                                className="flex-1 bg-transparent text-neutral-100 text-[16px] resize-none focus:outline-none max-h-32 py-2 px-4 min-h-[44px] custom-scrollbar disabled:opacity-50"
                                rows={1}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!inputText.trim() || composerDisabled}
                                className="p-3 bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full disabled:opacity-30 transition-all active:scale-95 shadow-xl shadow-purple-900/40 flex-shrink-0"
                            >
                                <Send size={18} className="translate-x-0.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


