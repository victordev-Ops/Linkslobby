'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Share2, Lock, Camera, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import { createClient } from '@/lib/supabase/client'

type Confession = {
  id: string
  message: string
  created_at: string
  is_read: boolean
  profile_id: string
}

type Props = {
  confession: Confession
  username: string
}

const GRADIENTS = [
  "bg-gradient-to-r from-rose-500 via-red-500 to-orange-500",
  "bg-gradient-to-r from-purple-600 to-blue-500",
  "bg-gradient-to-r from-emerald-500 to-teal-700",
  "bg-gradient-to-r from-fuchsia-600 to-pink-600",
  "bg-gradient-to-r from-amber-400 to-orange-600",
  "bg-gradient-to-r from-gray-900 to-gray-600",
]

export default function MessageViewClient({ confession, username }: Props) {
  const router = useRouter()
  const supabase = createClient()
  
  // Ref for the container that includes the background padding
  const shareWrapperRef = useRef<HTMLDivElement>(null)
  
  const [colorIndex, setColorIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const handleNextColor = () => setColorIndex((prev) => (prev + 1) % GRADIENTS.length)
  const handleClose = () => router.push('/inbox')

  /**
   * Generates the image from the ref
   */
  const generateImage = async () => {
    if (!shareWrapperRef.current) return null
    
    return await toPng(shareWrapperRef.current, { 
      cacheBust: true, 
      pixelRatio: 3, // High quality for social media
      backgroundColor: '#F9FAFB', // Matches gray-50
      style: {
        padding: '40px 20px', // Extra padding for the "screenshot" look
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }
    })
  }

  /**
   * Save Image (Camera Icon)
   */
  const handleSaveImage = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const dataUrl = await generateImage()
      if (dataUrl) {
        const link = document.createElement('a')
        link.download = `confession-${username}.png`
        link.href = dataUrl
        link.click()
      }
    } catch (err) {
      console.error("Save failed", err)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Share to Stories (Native Share API)
   */
  const handleShare = async () => {
    if (isSharing) return
    setIsSharing(true)
    try {
      const dataUrl = await generateImage()
      if (!dataUrl) return

      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'confession.png', { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Anonymous Message',
          text: `Send me anonymous messages! 👉 say-app.com/confess/${username}`,
        })
      } else {
        // Fallback to download
        handleSaveImage()
      }
    } catch (err) {
      console.error("Share failed", err)
    } finally {
      setIsSharing(false)
    }
  }

  const isLongMessage = confession.message.length > 150
  const textSizeClass = isLongMessage ? "text-xl leading-relaxed" : "text-2xl leading-tight"

  return (
    <div className="min-h-screen bg-gray-50 font-sans overflow-x-hidden">
      {/* Background layer */}
      <div className="fixed inset-x-0 top-0 h-96 bg-gradient-to-b from-pink-100/50 to-transparent pointer-events-none" />

      {/* Top Bar */}
      <div className="sticky top-0 px-6 pt-6 pb-4 flex items-center justify-end z-50 pointer-events-none">
        <button 
          onClick={handleClose} 
          className="pointer-events-auto p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-md hover:bg-white active:scale-90 transition-all"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      <div className="flex flex-col items-center px-6 pb-24 z-10 relative">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-sm"
        >
          {/* SHARE WRAPPER: 
              This is what gets captured. It includes the card 
              plus the spacing around it to show the background.
          */}
          <div ref={shareWrapperRef} className="py-8 px-4 w-full flex flex-col items-center bg-transparent">
            <div className="w-full rounded-[2.5rem] overflow-hidden shadow-2xl bg-white border border-gray-100">
              {/* Card Header */}
              <div className={`${GRADIENTS[colorIndex]} px-8 py-10 text-center transition-colors duration-500`}>
                <h1 className="text-white text-lg font-black tracking-tighter uppercase italic">
                  Anonymous Message
                </h1>
              </div>

              {/* Card Body */}
              <div className="px-8 pt-12 pb-10 min-h-[220px] flex flex-col items-center bg-white">
                <p className={`text-center text-gray-800 font-bold break-words whitespace-pre-wrap w-full ${textSizeClass}`}>
                  {confession.message}
                </p>

                <div className="mt-10 flex items-center gap-1.5 opacity-30">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    say-app/confess/{username}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interaction Controls */}
          <div className="flex justify-center gap-10 mt-6">
            <ControlBtn onClick={handleNextColor} label="Color">
               <div className={`w-10 h-10 rounded-full ${GRADIENTS[colorIndex]} shadow-inner`} />
            </ControlBtn>
            
            <ControlBtn onClick={handleSaveImage} label="Save" disabled={isSaving}>
               {isSaving ? <Loader2 className="animate-spin text-gray-400" /> : <Camera size={24} className="text-gray-700" />}
            </ControlBtn>
          </div>
        </motion.div>

        {/* Footer Actions */}
        <div className="mt-12 space-y-3 w-full max-w-sm">
            <button className="w-full bg-purple-50 text-purple-500 py-4 rounded-3xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors">
              <Lock size={16} />
              <span>Reveal Sender</span>
            </button>

            <button 
              onClick={handleShare}
              disabled={isSharing}
              className="w-full bg-black text-white font-bold text-lg py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70"
            >
              {isSharing ? <Loader2 className="animate-spin" size={20} /> : <Share2 size={20} />}
              <span>Share to Story</span>
            </button>
        </div>
      </div>
    </div>
  )
}

function ControlBtn({ children, onClick, label, disabled = false }: any) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-2 group">
      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg group-active:scale-90 transition-all border border-gray-50">
        {children}
      </div>
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{label}</span>
    </button>
  )
  }
                          
