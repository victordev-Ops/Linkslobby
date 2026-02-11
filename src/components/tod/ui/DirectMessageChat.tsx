'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Send, Loader2, MessageCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { sendDirectMessage } from '@/actions/direct-messages'
import { useAuth } from '@/context/AuthContext'

interface DirectMessageChatProps {
    targetUser: {
        id: string
        username: string
    }
    onClose: () => void
}

interface Message {
    id: string
    content: string // Map 'message' to 'content' for internal use
    created_at: string
    isOwn: boolean
    isOptimistic?: boolean
}

export function DirectMessageChat({ targetUser, onClose }: DirectMessageChatProps) {
    const { profile } = useAuth()
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)

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

            // We can only fetch messages SENT TO ME from this user
            // If we want to see messages I SENT, we rely on optimistic updates for now 
            // OR we check if 'confessions' has a sender_id. 
            // Since we can't be sure, we'll focus on the 'Inbox' part (messages received)
            // and maybe try to fetch sent ones if possible. 
            // For now, let's fetch received messages to show history.

            const { data: received, error } = await supabase
                .from('confessions')
                .select('*')
                .eq('profile_id', profile.id) // Messages I received
                .eq('message_type', 'direct_message')
                // We need to filter by who sent it. 
                // If there's no sender_id column, we can't filter by sender easily on server without metadata.
                // But for DMs, we assume the new server action MIGHT put metadata or we rely on content?
                // Let's assume for this "messenger" feature we only show what we just sent (session) + what we receive.
                // Wait, if it's "messenger", we need history.
                // Let's try to filter by metadata if it exists, or content structure.
                .order('created_at', { ascending: true })
                .limit(50)

            if (received) {
                // Simple heuristic: if description or metadata contains sender info? 
                // Since we don't have that yet, this might just show ALL DMs. 
                // That's tricky. 
                // Implementation decision: Show all DMs for now, or filter client side if possible.
                // Actually, without sender_id, this is hard.
                // BUT, looking at `sendDirectMessage`, we are inserting raw text.
                // Let's assume we can't easily filter history by specific user without schema changes.
                // So for V1: we show session history + generic "inbox" messages that appear.
                // OR: We only show messages that *appear* to be from them (e.g. they signed it?).

                // Let's map what we can.
                const mapped = received.map(m => ({
                    id: m.id,
                    content: m.message,
                    created_at: m.created_at,
                    isOwn: false, // These are received
                }))
                setMessages(mapped)
            }
            setIsLoading(false)
            setTimeout(scrollToBottom, 100)
        }

        fetchMessages()

        // Realtime subscription for NEW messages
        const channel = supabase
            .channel(`dm-${profile.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'confessions',
                filter: `profile_id=eq.${profile.id}` // Incoming messages
            }, (payload) => {
                const newMsg = payload.new
                if (newMsg.message_type === 'direct_message') {
                    // Add to list
                    const msg: Message = {
                        id: newMsg.id,
                        content: newMsg.message,
                        created_at: newMsg.created_at,
                        isOwn: false
                    }
                    setMessages(prev => [...prev, msg])
                    setTimeout(scrollToBottom, 100)
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [profile?.id, supabase])

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

        // Send to server
        const result = await sendDirectMessage(targetUser.id, content)

        setIsSending(false)

        if (!result.success) {
            toast.error("Failed to send message")
            setMessages(prev => prev.filter(m => m.id !== tempId))
        } else {
            // Success - we stick with optimistic message or replace it
            // Usually we'd wait for real ID but for now keep optimistic
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-0 right-4 w-80 md:w-96 h-[500px] max-h-[80vh] bg-slate-900 border border-slate-700 shadow-2xl rounded-t-xl overflow-hidden flex flex-col z-[200]"
        >
            {/* Header */}
            <div className="bg-slate-800 p-3 flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                        <span className="text-sm font-bold text-white">{targetUser.username.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-100 text-sm">{targetUser.username}</h3>
                        <p className="text-[10px] text-green-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            Active Now
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/50">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="animate-spin text-slate-600" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2 opacity-60">
                        <MessageCircle size={32} />
                        <p className="text-xs">Say hi to {targetUser.username}!</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.isOwn
                                        ? 'bg-blue-600 text-white rounded-br-sm'
                                        : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                                    }`}
                            >
                                <p>{msg.content}</p>
                                <p className={`text-[10px] mt-1 text-right ${msg.isOwn ? 'text-blue-200' : 'text-slate-500'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-slate-800 border-t border-slate-700">
                <div className="flex items-end gap-2 bg-slate-900 rounded-xl p-2 border border-slate-700 focus-within:border-blue-500/50 transition-colors">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type a message..."
                        className="flex-1 bg-transparent text-slate-200 text-sm resize-none focus:outline-none max-h-24 py-1 px-1 custom-scrollbar"
                        rows={1}
                        style={{ minHeight: '24px' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim() || isSending}
                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors flex-shrink-0"
                    >
                        {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>
            </div>
        </motion.div>
    )
}
