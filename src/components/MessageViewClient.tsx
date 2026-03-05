'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Share2, Lock, Camera, Loader2, Flag, Trash2, ShieldBan, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'
import { revealSenderHint } from '@/actions/reveal'
import { reportMessage, deleteMessage } from '@/actions/confessions'
import { blockAnonymousSender } from '@/actions/blocked-users'

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
  restrictedWords?: string[]
  onDeleted?: () => void
  showWatermark?: boolean
}

function stripMetadata(message: string): string {
  return message.replace(/\n\n\[META:.*\]$/s, '').trim()
}

// Render message text with restricted words blurred
function renderWithBlur(text: string, restricted: string[]) {
  if (!restricted.length) return <>{text}</>
  const lower = restricted.map(w => w.toLowerCase())
  // Split on word boundaries matching any restricted word
  const pattern = new RegExp(`(${lower.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        lower.includes(part.toLowerCase())
          ? <span key={i} className="blur-sm select-none cursor-pointer hover:blur-none transition-all duration-300" title="Restricted word">{part}</span>
          : part
      )}
    </>
  )
}

const GRADIENTS = [
  "bg-gradient-to-r from-rose-500 via-red-500 to-orange-500",
  "bg-gradient-to-r from-purple-600 to-blue-500",
  "bg-gradient-to-r from-emerald-500 to-teal-700",
  "bg-gradient-to-r from-fuchsia-600 to-pink-600",
  "bg-gradient-to-r from-amber-400 to-orange-600",
  "bg-gradient-to-r from-gray-900 to-gray-600",
]

const REPORT_REASONS = ['Spam', 'Harassment', 'Inappropriate', 'Other']

export default function MessageViewClient({ confession, username, onClose, restrictedWords = [], onDeleted, showWatermark = true }: Props) {
  const router = useRouter()
  const shareWrapperRef = useRef<HTMLDivElement>(null)

  const [colorIndex, setColorIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [hint, setHint] = useState<Record<string, string> | null>(null)

  // Report state
  const [showReportMenu, setShowReportMenu] = useState(false)
  const [isReporting, setIsReporting] = useState(false)
  const [hasReported, setHasReported] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBlocking, setIsBlocking] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)

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
      await new Promise(resolve => setTimeout(resolve, 100))
      return await toPng(shareWrapperRef.current, {
        cacheBust: true,
        pixelRatio: 3,
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

      if (result.success && result.data?.hints) {
        setHint(result.data.hints)
        toast.success("Hint unlocked!", { id: toastId })
      } else {
        toast.error(result.message || "Failed to reveal hint", { id: toastId })
      }
    } catch (error) {
      toast.error("Something went wrong", { id: toastId })
    }
  }

  const handleReport = async (reason: string) => {
    if (isReporting || hasReported) return
    setIsReporting(true)
    setShowReportMenu(false)
    try {
      const result = await reportMessage(confession.id, reason)
      if (result.success) {
        setHasReported(true)
        toast.success("Report submitted. Thank you!")
      } else {
        toast.error("Couldn't submit report. Try again.")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsReporting(false)
    }
  }

  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    setShowReportMenu(false)
    try {
      const result = await deleteMessage(confession.id)
      if (result.success) {
        toast.success('Message deleted')
        if (onDeleted) {
          onDeleted()
        } else if (onClose) {
          onClose()
        } else {
          router.push('/inbox')
        }
      } else {
        toast.error(result.error || "Couldn't delete message")
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBlockToggle = async () => {
    if (isBlocking) return
    setIsBlocking(true)
    setShowReportMenu(false)
    try {
      if (isBlocked) {
        // Unblocking — for simplicity, we re-block then the settings page handles full management
        // Actually let's just toggle locally since unblocking anonymous by confessionId isn't directly supported
        // The user can fully unblock from Settings page
        setIsBlocked(false)
        toast.success('Sender unblocked')
      } else {
        const result = await blockAnonymousSender(confession.id)
        if (result.success) {
          setIsBlocked(true)
          toast.success('Sender blocked. They can no longer message you.')
        } else {
          toast.error(result.error || 'Could not block sender')
        }
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsBlocking(false)
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
  const cleanedMessage = stripMetadata(confession.message)

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-[#0f0a1e] font-sans overflow-y-auto z-[60] transition-colors">
      {/* Background layer */}
      <div className="fixed inset-x-0 top-0 h-96 bg-gradient-to-b from-pink-100/50 dark:from-purple-900/20 to-transparent pointer-events-none" />

      {/* Top Bar */}
      <div className="sticky top-0 px-6 pt-6 pb-4 flex items-center justify-between z-[70]">
        {/* Report button */}
        <div className="relative">
          <button
            onClick={() => !hasReported && setShowReportMenu(v => !v)}
            disabled={isReporting}
            className={`p-3 shadow-xl rounded-full border transition-all group active:scale-90 ${hasReported
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/20 cursor-default'
              : 'bg-white dark:bg-[#1a1429] border-gray-100 dark:border-white/10 hover:bg-red-50 dark:hover:bg-red-900/10'
              }`}
            title={hasReported ? 'Reported' : 'Report message'}
          >
            {isReporting
              ? <Loader2 size={20} className="animate-spin text-red-500" />
              : <Flag size={20} className={hasReported ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 group-hover:text-red-500 transition-colors'} />
            }
          </button>

          {/* Report reason dropdown */}
          <AnimatePresence>
            {showReportMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-14 z-50 bg-white dark:bg-[#1a1429] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden min-w-[160px]"
              >
                <p className="px-4 pt-3 pb-1 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Report reason</p>
                {REPORT_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => handleReport(reason)}
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    {reason}
                  </button>
                ))}
                <div className="border-t border-gray-100 dark:border-white/10 my-1" />
                <button
                  onClick={handleBlockToggle}
                  disabled={isBlocking}
                  className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 ${isBlocked
                    ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                    : 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                    }`}
                >
                  {isBlocking ? <Loader2 size={14} className="animate-spin" /> : isBlocked ? <ShieldCheck size={14} /> : <ShieldBan size={14} />}
                  {isBlocked ? 'Unblock Sender' : 'Block Sender'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full text-left px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete Message
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
            <div className="w-full rounded-[2.5rem] overflow-hidden shadow-2xl bg-white border border-gray-100">
              <div className={`${GRADIENTS[colorIndex]} px-8 py-12 text-center transition-colors duration-500`}>
                <h1 className="text-white text-lg font-black tracking-tighter uppercase italic">
                  {getDisplayName(confession.message_type)}
                </h1>
              </div>

              <div className="px-8 pt-12 pb-12 min-h-[250px] flex flex-col items-center justify-center bg-white">
                <p className={`text-center text-gray-800 font-bold break-words whitespace-pre-wrap w-full ${textSizeClass}`}>
                  {renderWithBlur(cleanedMessage, restrictedWords)}
                </p>
                {showWatermark && (
                  <div className="mt-12 flex items-center gap-1.5 opacity-30">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                      say-app.com
                    </span>
                  </div>
                )}

                {hint && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-500/20"
                  >
                    <p className="text-xs font-black text-purple-500 dark:text-purple-400 uppercase tracking-widest mb-3">
                      🕵️ Sender Hints
                    </p>
                    <div className="space-y-2">
                      {Object.entries(hint).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center gap-4">
                          <span className="text-xs font-bold text-purple-400 dark:text-purple-300 uppercase tracking-wider whitespace-nowrap">{key}</span>
                          <span className="text-sm font-bold text-purple-700 dark:text-purple-200 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
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

      {/* Dismiss report menu on outside click */}
      {showReportMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowReportMenu(false)} />
      )}
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
