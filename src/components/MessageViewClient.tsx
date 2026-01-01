'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Share2, Lock, Camera, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import { createClient } from '@/lib/supabase/client' // Assuming standard path

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
  const cardRef = useRef<HTMLDivElement>(null)
  
  const [colorIndex, setColorIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  // 1. Mark as read on mount
/*  useEffect(() => {
    const markAsRead = async () => {
      if (!confession.is_read) {
        await supabase
          .from('confessions')
          .update({ is_read: true })
          .eq('id', confession.id)
      }
    }
    markAsRead()
  }, [confession.id, confession.is_read, supabase])
*/

  const handleNextColor = () => setColorIndex((prev) => (prev + 1) % GRADIENTS.length)

  // 2. Consistent navigation
  const handleClose = () => {
    router.push('/inbox')
    //router.refresh()
  }

  const handleSaveImage = async () => {
    if (!cardRef.current || isSaving) return
    setIsSaving(true)
    
    try {
      // Optimization: Ensure fonts are loaded before capture
      const dataUrl = await toPng(cardRef.current, { 
        cacheBust: true, 
        pixelRatio: 3,
        style: { transform: 'scale(1)' } // Fixes weird scaling bugs in some browsers
      })
      
      const link = document.createElement('a')
      link.download = `say-app/confess-${username}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Capture failed", err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-x-hidden font-sans">
      {/* 3. Improved Background layer */}
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-pink-100/50 to-transparent pointer-events-none" />

      {/* Top Bar */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">@</div>
           //<span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Inbox</span>
        </div>
        <button 
          onClick={handleClose} 
          className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 active:scale-90 transition-all"
          aria-label="Close"
        >
          <X size={20} className="text-gray-400" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 25 }}
          className="w-full max-w-sm"
        >
          <div ref={cardRef} className="rounded-[2.5rem] overflow-hidden shadow-2xl bg-white border border-gray-100">
            <div className={`${GRADIENTS[colorIndex]} px-8 py-10 text-center transition-colors duration-500`}>
              <h1 className="text-white text-lg font-black tracking-tighter uppercase italic">
                Anonymous Message
              </h1>
            </div>

            <div className="px-8 pt-14 pb-8 min-h-[220px] flex flex-col items-center justify-between bg-white">
              <p className="text-center text-gray-800 font-bold text-2xl leading-tight break-words w-full">
                {confession.message}
              </p>

              <div className="mt-8 flex items-center gap-1.5 opacity-30">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  say-app/confess/{username}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-10 mt-10">
            <ControlBtn onClick={handleNextColor} label="Color">
               <div className={`w-10 h-10 rounded-full ${GRADIENTS[colorIndex]} shadow-inner`} />
            </ControlBtn>
            
            <ControlBtn onClick={handleSaveImage} label="Save" disabled={isSaving}>
               {isSaving ? <Loader2 className="animate-spin text-gray-400" /> : <Camera size={24} className="text-gray-700" />}
            </ControlBtn>
          </div>
        </motion.div>
      </div>

      {/* Footer Actions */}
      <div className="px-6 pb-10 space-y-3 z-10 max-w-sm mx-auto w-full">
        <button className="w-full bg-purple-50 text-purple-500 py-4 rounded-3xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors">
          <Lock size={16} />
          <span>Reveal Sender</span>
        </button>

        <button className="w-full bg-black text-white font-bold text-lg py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all">
          <Share2 size={20} />
          <span>Share to Story</span>
        </button>
      </div>
    </div>
  )
}

// Helper component for cleaner code
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
                                              
