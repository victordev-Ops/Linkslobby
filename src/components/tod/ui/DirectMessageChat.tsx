'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Send, Loader2, MessageCircle, Image as ImageIcon, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { sendDirectMessage } from '@/actions/direct-messages'
import { useAuth } from '@/context/AuthContext'
import { compressImage } from '@/lib/image-utils'
import { Lightbox } from './Lightbox'

interface DirectMessageChatProps {
    targetUser: {
        id: string
        username: string
    }
    onClose: () => void
}

interface Message {
    id: string
    content: string
    image_url?: string | null
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
    const [isUploading, setIsUploading] = useState(false)
    const [selectedImage, setSelectedImage] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

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

            // Fetch history where I am either the sender or receiver with this specific user
            // We use .or to check both directions
            const { data, error } = await supabase
                .from('confessions')
                .select('*')
                .eq('message_type', 'direct_message')
                .or(`and(profile_id.eq.${profile.id},sender_id.eq.${targetUser.id}),and(profile_id.eq.${targetUser.id},sender_id.eq.${profile.id})`)
                .order('created_at', { ascending: true })
                .limit(50)

            if (data) {
                const mapped = data.map(m => ({
                    id: m.id,
                    content: m.message,
                    image_url: m.image_url,
                    created_at: m.created_at,
                    isOwn: m.sender_id === profile.id,
                }))
                setMessages(mapped)
            }
            setIsLoading(false)
            setTimeout(scrollToBottom, 500)
        }

        fetchMessages()

        // Realtime subscription for NEW messages
        const channel = supabase
            .channel(`dm-${profile.id}-${targetUser.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'confessions',
                filter: `message_type=eq.direct_message`
            }, (payload) => {
                const newMsg = payload.new
                // Only add if it's between these two users
                const isRelevant =
                    (newMsg.profile_id === profile.id && newMsg.sender_id === targetUser.id) ||
                    (newMsg.profile_id === targetUser.id && newMsg.sender_id === profile.id)

                if (isRelevant && !messages.some(m => m.id === newMsg.id)) {
                    const msg: Message = {
                        id: newMsg.id,
                        content: newMsg.message,
                        image_url: newMsg.image_url,
                        created_at: newMsg.created_at,
                        isOwn: newMsg.sender_id === profile.id
                    }
                    setMessages(prev => {
                        if (prev.some(m => m.id === msg.id)) return prev
                        return [...prev, msg]
                    })
                    setTimeout(scrollToBottom, 100)
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [profile?.id, targetUser.id, supabase])

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error("Please select an image file")
            return
        }

        setSelectedImage(file)
        setImagePreview(URL.createObjectURL(file))
    }

    const removeImage = () => {
        setSelectedImage(null)
        if (imagePreview) URL.revokeObjectURL(imagePreview)
        setImagePreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleSend = async () => {
        if (!inputText.trim() && !selectedImage) return

        setIsSending(true)
        const content = inputText
        const tempId = `temp-${Date.now()}`
        let imageUrl: string | null = null

        // 1. Upload image if exists
        if (selectedImage) {
            setIsUploading(true)
            try {
                // Compress before upload
                const optimizedFile = await compressImage(selectedImage)

                const fileExt = optimizedFile.name.split('.').pop() || 'jpg'
                const fileName = `${Date.now()}-${selectedImage.name}`
                const filePath = `${profile?.id}/${fileName}` // Must start with user ID for RLS

                const { error: uploadError } = await supabase.storage
                    .from('chat-attachments') // Consolidated bucket
                    .upload(filePath, optimizedFile)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('chat-attachments')
                    .getPublicUrl(filePath)

                imageUrl = publicUrl
            } catch (err: any) {
                toast.error("Failed to upload image")
                setIsSending(false)
                setIsUploading(false)
                return
            }
            setIsUploading(false)
        }

        // Optimistic Update
        const optimisticMsg: Message = {
            id: tempId,
            content: content,
            image_url: imageUrl,
            created_at: new Date().toISOString(),
            isOwn: true,
            isOptimistic: true
        }

        setMessages(prev => [...prev, optimisticMsg])
        setInputText('')
        removeImage()
        scrollToBottom()

        // Send to server
        const result = await sendDirectMessage(targetUser.id, content, imageUrl)

        setIsSending(false)

        if (!result.success) {
            toast.error("Failed to send message")
            setMessages(prev => prev.filter(m => m.id !== tempId))
        } else {
            // Replace with real ID
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: result.id!, isOptimistic: false } : m))
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
            className="fixed bottom-0 right-4 w-80 md:w-96 h-[550px] max-h-[90vh] bg-slate-900 border border-slate-700 shadow-2xl rounded-t-xl overflow-hidden flex flex-col z-[200]"
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/50 custom-scrollbar">
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
                                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.isOwn
                                    ? 'bg-blue-600 text-white rounded-br-sm shadow-md'
                                    : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700'
                                    } ${msg.isOptimistic ? 'opacity-70' : ''}`}
                            >
                                {msg.image_url && (
                                    <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                                        <img
                                            src={msg.image_url}
                                            alt="Shared"
                                            className="w-full max-h-48 object-cover cursor-pointer hover:scale-105 transition-transform"
                                            onClick={() => setLightboxUrl(msg.image_url!)}
                                        />
                                    </div>
                                )}
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                <div className="flex items-center justify-end gap-1 mt-1 opacity-70">
                                    <p className="text-[9px]">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    {msg.isOwn && (
                                        msg.isOptimistic ? <Loader2 size={8} className="animate-spin" /> : <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Image Preview Overlay */}
            <AnimatePresence>
                {imagePreview && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="px-4 py-3 bg-slate-800 border-t border-slate-700"
                    >
                        <div className="relative inline-block">
                            <img
                                src={imagePreview}
                                alt="Preview"
                                className="h-20 w-20 rounded-xl object-cover border-2 border-blue-500/50 shadow-lg"
                            />
                            <button
                                onClick={removeImage}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg transition-transform active:scale-90"
                                title="Remove image"
                            >
                                <X size={14} />
                            </button>
                            {isUploading && (
                                <div className="absolute inset-0 bg-slate-900/40 rounded-xl flex items-center justify-center">
                                    <Loader2 size={20} className="animate-spin text-white" />
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-3 bg-slate-800 border-t border-slate-700">
                <div className="flex items-end gap-2 bg-slate-900 rounded-xl p-2 border border-slate-700 focus-within:border-blue-500/50 transition-colors">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl transition-all active:scale-90 flex-shrink-0"
                        title="Add image"
                        disabled={isSending}
                    >
                        <ImageIcon size={20} />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        className="hidden"
                    />
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
                        disabled={(!inputText.trim() && !selectedImage) || isSending}
                        className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-30 transition-all active:scale-90 flex-shrink-0 shadow-lg shadow-blue-900/20"
                    >
                        {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                </div>
            </div>

            {/* Lightbox */}
            <Lightbox
                src={lightboxUrl || ''}
                isOpen={!!lightboxUrl}
                onClose={() => setLightboxUrl(null)}
            />
        </motion.div>
    )
}
