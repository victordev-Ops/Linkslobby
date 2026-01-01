// src/components/MessageViewClient.tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Share2, Lock, Camera, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'

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
  const cardRef = useRef<HTMLDivElement>(null)
  
  const [colorIndex, setColorIndex] = useState(0)
  const [isCopying, setIsCopying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleNextColor = () => setColorIndex((prev) => (prev + 1) % GRADIENTS.length)
  const handleClose = () => { router.refresh(); router.push('/inbox') }

  const handleSaveImage = async () => {
    if (!cardRef.current) return
    setIsSaving(true)
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 3 })
      const link = document.createElement('a')
      link.download = `msg-${username}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-pink-100/50 to-transparent -z-10" />

      {/* Top Bar */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">@</div>
           <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Inbox</span>
        </div>
        <button onClick={handleClose} className="p-2 bg-white rounded-full shadow-sm active:scale-90 transition-transform">
          <X size={20} className="text-gray-400" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
        <motion.div
          initial={{ scale: 1.15, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="w-full max-w-sm"
        >
          {/* Capture Area */}
          <div ref={cardRef} className="rounded-[2.5rem] overflow-hidden shadow-[0_30px_60px_-12px_rgba(0,0,0,0.2)] bg-white border border-gray-100">
            
            <div className={`${GRADIENTS[colorIndex]} px-8 py-10 text-center transition-colors duration-500`}>
              <h1 className="text-white text-lg font-black tracking-tighter uppercase italic">
                Send me anonymous messages!
              </h1>
            </div>

            <div className="px-8 pt-14 pb-8 min-h-[220px] flex flex-col items-center justify-between bg-white relative">
              {/* Message Body */}
              <p className="text-center text-gray-800 font-bold text-2xl leading-tight">
                {confession.message}
              </p>

              {/* NEW: Watermark Tag */}
              <div className="mt-8 flex items-center gap-1.5 opacity-40 grayscale">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  say-app/confess/{username}
                </span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-10 mt-10">
            <button onClick={handleNextColor} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <div className={`w-10 h-10 rounded-full ${GRADIENTS[colorIndex]}`} />
              </div>
              <span className="text-[10px] font-black text-gray-400 uppercase">Color</span>
            </button>
            
            <button onClick={handleSaveImage} disabled={isSaving} className="flex flex-col items-center gap-2">
               <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all">
                {isSaving ? <Loader2 className="animate-spin text-gray-300" /> : <Camera size={24} className="text-gray-700" />}
              </div>
              <span className="text-[10px] font-black text-gray-400 uppercase">Save</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-10 space-y-3 z-10">
        <button className="w-full bg-red-50 text-red-500 py-4 rounded-3xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
          <Lock size={16} />
          <span>Reveal Sender</span>
        </button>

        <button onClick={() => {}} className="w-full bg-black text-white font-bold text-lg py-5 rounded-3xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
          <Share2 size={20} />
          <span>Share to Story</span>
        </button>
      </div>
    </div>
  )
  }
  
