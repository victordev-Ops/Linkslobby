'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Loader2, MessageCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { sendDirectMessage } from '@/actions/direct-messages'
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

// Helper to extract sender ID from message
const getSenderId = (content: string) => {
    const match = content.match(/^\[DM:([a-f0-9-]+)\]/);
    return match ? match[1] : null;
}

// Helper to clean message
const cleanMessage = (content: string) => content.replace(/^\[DM:[a-f0-9-]+\]\s*/, '');

export default function DirectMessageClient({ targetUserId, targetUsername }: DirectMessageClientProps) {
    const { profile } = useAuth()
    const router = useRouter()
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Typing State
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const supabase = createClient()

    // Scroll to bottom helper
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    // Initial Fetch & Subscription
    useEffect(() => {
        if (!profile?.id) return

        const fetchMessages = async () => {
            setIsLoading(true)

            // We need to fetch both SENT (by me to them) and RECEIVED (by them to me)
            // But 'confessions' table owner is the 'profile_id'.
            // RECEIVED: profile_id = ME, content starts with [DM:THEM]
            // SENT: profile_id = THEM, content starts with [DM:ME]

            const { data: allMessages, error } = await supabase
                .from('confessions')
                .select('*')
                .in('profile_id', [profile.id, targetUserId])
                .eq('message_type', 'confession')
                .ilike('message', '[DM:%')
                .order('created_at', { ascending: true })
                .limit(100)

            if (allMessages) {
                const filtered = allMessages.filter(m => {
                    const senderId = getSenderId(m.message);
                    const isReceived = m.profile_id === profile.id && senderId === targetUserId;
                    const isSent = m.profile_id === targetUserId && senderId === profile.id;
                    return isReceived || isSent;
                }).map(m => ({
                    id: m.id,
                    content: cleanMessage(m.message),
                    created_at: m.created_at,
                    isOwn: m.profile_id === targetUserId, // If it's on THEIR profile, I sent it
                    isRead: m.is_read
                }));
                setMessages(filtered);

                // Mark unread received messages as read
                const unreadIds = allMessages
                    .filter(m => m.profile_id === profile.id && !m.is_read)
                    .map(m => m.id);

                if (unreadIds.length > 0) {
                    await supabase.rpc('mark_confessions_read', { confession_ids: unreadIds })
                        .catch(async () => {
                            // Fallback loop if RPC missing
                            for (const id of unreadIds) {
                                await supabase.from('confessions').update({ is_read: true }).eq('id', id);
                            }
                        });
                }
            }
            setIsLoading(false)
            setTimeout(scrollToBottom, 100)
        }

        fetchMessages()

        // Realtime Subscription for Messages
        const msgChannel = supabase
            .channel(`dm-chat-${profile.id}-${targetUserId}`)
            .on('postgres_changes', {
                event: '*', // Listen for inserts (new msgs) and updates (read receipts)
                schema: 'public',
                table: 'confessions',
                filter: `profile_id=in.(${profile.id},${targetUserId})`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new;
                    const senderId = getSenderId(newMsg.message);

                    // Check if relevant
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
                            // Avoid dupes
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg];
                        })
                        setTimeout(scrollToBottom, 100)

                        // If received, mark read
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
                // Check who is typing
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

    const handleTyping = async () => {
        const presenceChannel = supabase.channel(`dm-presence-${[profile!.id, targetUserId].sort().join('-')}`);
        await presenceChannel.track({ user_id: profile!.id, isTyping: true });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(async () => {
            await presenceChannel.track({ user_id: profile!.id, isTyping: false });
        }, 1500);
    }

    const handleSend = async () => {
        if (!inputText.trim()) return

        const content = inputText
        const tempId = `temp-${Date.now()}`

        // Optimistic Update
        const optimisticMsg: Message = {
            id: tempId,
            content: content,
            created_at: new Date().toISOString(),
            isOwn: true,
            isOptimistic: true
        }

        setMessages(prev => [...prev, optimisticMsg])
        setInputText('')
        setIsSending(true)
        setTimeout(scrollToBottom, 50)

        try {
            const result = await sendDirectMessage(targetUserId, content)

            if (!result.success) {
                console.error("Failed to send:", result.error)
                toast.error("Failed to send message")
                setMessages(prev => prev.filter(m => m.id !== tempId))
            }
        } catch (err) {
            console.error("Exception sending message:", err)
            toast.error("Error sending message")
            setMessages(prev => prev.filter(m => m.id !== tempId))
        } finally {
            setIsSending(false)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    if (!profile) return null // Or loading state

    return (
        <div className="flex flex-col h-[100dvh] bg-neutral-950 text-neutral-200">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 bg-neutral-900/50 backdrop-blur-md border-b border-white/5 flex items-center gap-3 sticky top-0 z-10">
                <Link
                    href="/tod/game"
                    className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors text-neutral-400 hover:text-white"
                >
                    <ArrowLeft size={24} />
                </Link>

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-900/20">
                        {targetUsername.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="font-bold text-white text-base leading-tight">
                            {targetUsername}
                        </h1>
                        <p className="text-xs text-green-400 font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Active Now
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="animate-spin text-purple-500 w-8 h-8" />
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
                                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-5 py-3 text-[15px] leading-relaxed shadow-sm ${msg.isOwn
                                    ? 'bg-purple-600 text-white rounded-br-none'
                                    : 'bg-neutral-800 text-neutral-200 rounded-bl-none'
                                    }`}
                            >
                                <p>{msg.content}</p>
                                <p className={`text-[10px] mt-1.5 text-right font-medium ${msg.isOwn ? 'text-purple-200/70' : 'text-neutral-500'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {msg.isOwn && (
                                        <span className="ml-1">
                                            {msg.isOptimistic ? '🕒' : msg.isRead ? '✅' : '✓'}
                                        </span>
                                    )}
                                </p>
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
            <div className="flex-shrink-0 p-4 bg-neutral-900/80 backdrop-blur-xl border-t border-white/5 pb-8 sm:pb-4">
                <div className="flex items-end gap-2 bg-neutral-900 rounded-[1.5rem] p-1.5 border border-white/10 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all shadow-lg">
                    <textarea
                        value={inputText}
                        onChange={(e) => {
                            setInputText(e.target.value)
                            handleTyping()
                        }}
                        onKeyDown={handleKeyPress}
                        placeholder="Message..."
                        className="flex-1 bg-transparent text-neutral-200 text-base resize-none focus:outline-none max-h-32 py-3 px-4 min-h-[48px] custom-scrollbar"
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim() || isSending}
                        className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full disabled:opacity-50 disabled:hover:bg-purple-600 transition-all active:scale-95 shadow-lg shadow-purple-900/20 mb-0.5 mr-0.5"
                    >
                        {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
                    </button>
                </div>
            </div>
        </div>
    )
}
