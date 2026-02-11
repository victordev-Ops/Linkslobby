'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Share2, Lock, Camera, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'
import { revealSenderHint } from '@/actions/reveal'

type Confession = {
  id: string
  message: string
  created_at: string
  is_read: boolean
  profile_id: string
  message_type: 'confession' | 'ama' | 'anonymous' | 'direct_message'
}

type Props = {
  confession: Confession
  username: string
  onClose?: () => void
}

function stripMetadata(message: string): string {
  return message.replace(/\n\n\[META:.*\]$/s, '').trim()
}

const GRADIENTS = [
  "bg-gradient-to-r from-rose-500 via-red-500 to-orange-500",
  "bg-gradient-to-r from-purple-600 to-blue-500",
  "bg-gradient-to-r from-emerald-500 to-teal-700",
  "bg-gradient-to-r from-fuchsia-600 to-pink-600",
  "bg-gradient-to-r from-amber-400 to-orange-600",
  "bg-gradient-to-r from-gray-900 to-gray-600",
]

export default function MessageViewClient({ confession, username, onClose }: Props) {
  const router = useRouter()
  const shareWrapperRef = useRef<HTMLDivElement>(null)

  const [colorIndex, setColorIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const handleNextColor = () => setColorIndex((prev) => (prev + 1) % GRADIENTS.length)

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onClose) {
      onClose()
    } else {
      router.push('/inbox')
    }
  }

  const generateImage = async () => {
    if (!shareWrapperRef.current) return null
    try {
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100))
      return await toPng(shareWrapperRef.current, {
        cacheBust: true,
        pixelRatio: 3, // Higher quality for sharing
        quality: 1,
        backgroundColor: '#F9FAFB',
      })
    } catch (error) {
      console.error('Image generation failed:', error)
      toast.error("Couldn't generate image")
      return null
    }
  }

  const handleSaveImage = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    try {
      const dataUrl = await generateImage()
      if (dataUrl) {
        const link = document.createElement('a')
        link.download = `message-${confession.id.slice(0, 5)}.png`
        link.href = dataUrl
        link.click()
        toast.success("Saved to gallery")
      }
    } catch (err) {
      console.error("Save failed", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (isSharing) return
    setIsSharing(true)
    try {
      const dataUrl = await generateImage()
      if (!dataUrl) return

      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'message.png', { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: getDisplayName(confession.message_type),
        })
      } else {
        // Fallback to download if Web Share API isn't supported
        const link = document.createElement('a')
        link.download = 'message.png'
        link.href = dataUrl
        link.click()
        toast.info("Downloading image (Share not supported)")
      }
    } catch (err) {
      console.error("Share failed", err)
    } finally {
      setIsSharing(false)
    }
  }

  const handleReveal = async () => {
    if (hint) return

    const toastId = toast.loading("Unlocking hint...")
    try {
      const result = await revealSenderHint(confession.id)

      if (result.success && result.data?.hint) {
        setHint(result.data.hint)
        toast.success("Hint unlocked!", { id: toastId })
      } else {
        toast.error(result.message || "Failed to reveal hint", { id: toastId })
      }
    } catch (error) {
      toast.error("Something went wrong", { id: toastId })
    }
  }

  const getDisplayName = (type: Confession['message_type']) => {
    switch (type) {
      case 'confession': return 'Confession'
      case 'ama': return 'AMA Message'
      case 'direct_message': return 'Direct Message'
      default: return 'Anonymous Message'
    }
  }

  const isLongMessage = confession.message.length > 150
  const textSizeClass = isLongMessage ? "text-xl leading-relaxed" : "text-2xl leading-tight"

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-[#0f0a1e] font-sans overflow-y-auto z-[60] transition-colors">
      {/* Background layer */}
      <div className="fixed inset-x-0 top-0 h-96 bg-gradient-to-b from-pink-100/50 dark:from-purple-900/20 to-transparent pointer-events-none" />

      {/* Top Bar - Fixed and always clickable */}
      <div className="sticky top-0 px-6 pt-6 pb-4 flex items-center justify-end z-[70]">
        <button
          onClick={handleClose}
          className="p-3 bg-white dark:bg-[#1a1429] shadow-xl rounded-full border border-gray-100 dark:border-white/10 active:scale-90 transition-all group"
        >
          <X size={24} className="text-gray-900 dark:text-white group-hover:rotate-90 transition-transform" />
        </button>
      </div>

      <div className="flex flex-col items-center px-6 pb-24 relative z-10">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-sm"
        >
          {/* THE CAPTURE AREA */}
          <div ref={shareWrapperRef} className="p-4 bg-transparent">
            {/* Kept as white for sharing consistency, but you could offer dark mode variants later if requested */}
            <div className="w-full rounded-[2.5rem] overflow-hidden shadow-2xl bg-white border border-gray-100">
              <div className={`${GRADIENTS[colorIndex]} px-8 py-12 text-center transition-colors duration-500`}>
                <h1 className="text-white text-lg font-black tracking-tighter uppercase italic">
                  {getDisplayName(confession.message_type)}
                </h1>
              </div>

              <div className="px-8 pt-12 pb-12 min-h-[250px] flex flex-col items-center justify-center bg-white">
                <p className={`text-center text-gray-800 font-bold break-words whitespace-pre-wrap w-full ${textSizeClass}`}>
                  {stripMetadata(confession.message)}
                </p>
                <div className="mt-12 flex items-center gap-1.5 opacity-30">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    say-app.com/confess/{username}
                  </span>
                </div>

                {hint && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-500/20"
                  >
                    <p className="text-sm font-bold text-purple-700 dark:text-purple-300">
                      🕵️ Warning: {hint}
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Interaction Controls */}
          <div className="flex justify-center gap-8 mt-8">
            <ControlBtn onClick={handleNextColor} label="Theme">
              <div className={`w-10 h-10 rounded-full ${GRADIENTS[colorIndex]} shadow-inner ring-2 ring-white dark:ring-[#1a1429]`} />
            </ControlBtn>

            <ControlBtn onClick={handleSaveImage} label="Save" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin text-purple-600 dark:text-purple-400" /> : <Camera size={26} className="text-gray-800 dark:text-white" />}
            </ControlBtn>
          </div>

          {/* Footer Actions */}
          <div className="mt-12 space-y-4">
            <button
              onClick={handleReveal}
              className="w-full bg-white dark:bg-[#1a1429] border-2 border-purple-100 dark:border-white/10 text-purple-600 dark:text-purple-400 py-4 rounded-3xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
            >
              <Lock size={18} />
              <span>Reveal Sender</span>
            </button>

            <button
              onClick={handleShare}
              disabled={isSharing}
              className="w-full bg-black dark:bg-white text-white dark:text-black font-bold text-lg py-5 rounded-[2rem] shadow-2xl flex items-center justify-center gap-3 active:scale-[0.97] transition-all disabled:opacity-70 icon-bounce"
            >
              {isSharing ? <Loader2 className="animate-spin" size={24} /> : <Share2 size={24} />}
              <span>Share to Story</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function ControlBtn({ children, onClick, label, disabled = false }: {
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 group disabled:opacity-50"
    >
      <div className="w-16 h-16 bg-white dark:bg-[#1a1429] rounded-2xl flex items-center justify-center shadow-lg group-active:scale-90 transition-all border border-gray-50 dark:border-white/10 text-gray-900 dark:text-white">
        {children}
      </div>
      <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</span>
    </button>
  )
}
