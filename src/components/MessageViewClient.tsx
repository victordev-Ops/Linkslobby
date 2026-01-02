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

// Updated gradients to match the vibrant social media look
const GRADIENTS = [
  "bg-gradient-to-r from-rose-500 via-red-500 to-orange-500", // The classic NGL look
  "bg-gradient-to-r from-violet-600 to-indigo-600",
  "bg-gradient-to-r from-emerald-500 to-teal-500",
  "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500",
  "bg-gradient-to-bl from-gray-900 to-gray-600",
]

export default function MessageViewClient({ confession, username }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const cardRef = useRef<HTMLDivElement>(null)
  
  const [colorIndex, setColorIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  const handleNextColor = () => setColorIndex((prev) => (prev + 1) % GRADIENTS.length)

  const handleClose = () => {
    router.push('/inbox')
  }

  const handleSaveImage = async () => {
    if (!cardRef.current || isSaving) return
    setIsSaving(true)
    
    try {
      const dataUrl = await toPng(cardRef.current, { 
        cacheBust: true, 
        pixelRatio: 4, // Higher quality for social media (Instagram compresses images)
        backgroundColor: 'transparent', // Ensures corners stay rounded
      })
      
      const link = document.createElement('a')
      link.download = `confession-${username}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Capture failed", err)
      alert("Failed to save image. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-x-hidden font-sans">
      
      {/* Background Decor */}
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-pink-100/50 to-transparent pointer-events-none" />

      {/* Top Bar */}
      <div className="px-6 pt-8 pb-4 flex items-center justify-end z-10">
        <button 
          onClick={handleClose} 
          className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 active:scale-95 transition-all"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        
        {/* WRAPPER: 
          We use layout-box to allow the card to expand naturally.
        */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-[360px]" // Limits width to standard phone size
        >
          
          {/* --- THE CAPTURE TARGET --- */}
          <div ref={cardRef} className="relative rounded-[2.5rem] overflow-hidden shadow-2xl bg-white isolate">
            
            {/* 1. The Gradient Header */}
            <div className={`${GRADIENTS[colorIndex]} pt-10 pb-12 px-8 text-center transition-colors duration-500 relative z-10`}>
              <h1 className="text-white text-[1.1rem] font-black tracking-tight uppercase drop-shadow-sm">
                send me anonymous messages!
              </h1>
            </div>

            {/* 2. The Message Body (White Part) */}
            {/* -mt-6 pulls the white part up to slightly overlap or connect cleanly */}
            <div className="bg-white px-8 pt-8 pb-10 flex flex-col items-center min-h-[200px] relative z-20">
              
              {/* Message Text */}
              <p className="text-center text-gray-900 font-bold text-[1.35rem] leading-tight break-words w-full">
                {confession.message}
              </p>

              {/* Watermark / Footer */}
              <div className="mt-10 flex items-center gap-1.5 opacity-40">
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">
                  say-app • {username}
                </span>
              </div>
            </div>

          </div>
          {/* --- END CAPTURE TARGET --- */}

          {/* Controls */}
          <div className="flex justify-center gap-12 mt-10">
            <ControlBtn onClick={handleNextColor} label="Color">
               <div className={`w-8 h-8 rounded-full ${GRADIENTS[colorIndex]} ring-2 ring-white shadow-sm`} />
            </ControlBtn>
            
            <ControlBtn onClick={handleSaveImage} label="Save" disabled={isSaving}>
               {isSaving ? (
                 <Loader2 className="animate-spin text-gray-400" size={24} />
               ) : (
                 <Camera size={24} className="text-gray-800" />
               )}
            </ControlBtn>
          </div>

        </motion.div>
      </div>

      {/* Footer Actions */}
      <div className="px-6 pb-8 space-y-3 z-10 max-w-sm mx-auto w-full mt-auto">
        <button className="w-full bg-purple-50 text-purple-600 py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors">
          <Lock size={16} />
          <span>Reveal Sender</span>
        </button>

        <button className="w-full bg-black text-white font-bold text-lg py-4 rounded-full shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all">
          <Share2 size={20} />
          <span>Share to Story</span>
        </button>
      </div>
    </div>
  )
}

function ControlBtn({ children, onClick, label, disabled = false }: any) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-2 group active:scale-95 transition-transform">
      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 group-hover:border-gray-200">
        {children}
      </div>
      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
    </button>
  )
          }
