'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Share2, AlertTriangle, Camera } from 'lucide-react'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image' // Import the library
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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

export default function MessageViewClient({ confession, username }: Props) {
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null) // Reference for the screenshot
  const [copied, setCopied] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const cleanMessageText = (text: string) => {
    return text.replace(/^(message|Message)[:\s-]*/, '').trim()
  }

  const finalMessage = cleanMessageText(confession.message)

  const handleClose = () => {
    router.refresh()
    router.push('/inbox')
  }

  // PNG Export Function
  const exportAsPng = async () => {
    if (cardRef.current === null) return
    setIsExporting(true)
    
    try {
      const dataUrl = await toPng(cardRef.current, { 
        cacheBust: true,
        backgroundColor: 'transparent' // Ensures only the card shows
      })
      const link = document.createElement('a')
      link.download = `confession-${confession.id}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export failed', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleReply = async () => {
    const shareUrl = `${window.location.origin}/confess/${username}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Anonymous Message',
          text: 'Check out this message!',
          url: shareUrl,
        })
      } catch (err) { console.log('Cancelled', err) }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-400/30 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-orange-400/30 rounded-full blur-[100px] pointer-events-none" />

      {/* Close Button - Fast Fade In */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={handleClose}
        className="absolute top-6 right-6 p-3 bg-white/80 backdrop-blur-md rounded-full shadow-sm hover:bg-white transition-colors z-50 group"
      >
        <X size={24} className="text-gray-600 group-hover:text-red-500 transition-colors" />
      </motion.button>

      {/* Main Content */}
      <div className="w-full max-w-md px-6 z-10 flex flex-col items-center gap-6">
        
        {/* THE CARD: Reference starts at these borders */}
        <motion.div
          ref={cardRef} 
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/50 flex flex-col"
        >
          {/* Header with Report Icon */}
          <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-6 text-center relative">
             <div className="flex justify-between items-center relative z-10">
               <div className="w-8" /> {/* Spacer */}
               <h2 className="text-white font-black text-lg uppercase tracking-widest opacity-90">
                 Anonymous
               </h2>
               <button className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                 <AlertTriangle size={20} className="text-white/80" />
               </button>
             </div>
          </div>

          {/* Message Body: 1000 char stability */}
          <div className="px-8 py-10 min-h-[200px] max-h-[400px] flex items-center justify-center bg-white overflow-y-auto">
            <p className={cn(
              "text-center font-bold text-gray-800 leading-tight break-words",
              finalMessage.length > 150 ? "text-xl" : "text-3xl"
            )}>
              {finalMessage}
            </p>
          </div>

          <div className="pb-6 flex justify-center opacity-30">
            <div className="flex gap-2 text-2xl grayscale">
               <span>📸</span><span>💬</span>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="w-full space-y-3">
          <button
            onClick={handleReply}
            className="w-full group relative overflow-hidden bg-black text-white font-bold text-xl py-5 rounded-full shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center gap-3"
          >
            <span className="relative z-10 flex items-center gap-2">
              {copied ? 'Link Copied! ✅' : 'Reply on Story'} 
              {!copied && <Share2 size={22} />}
            </span>
          </button>

          {/* New Screenshot Button */}
          <button
            onClick={exportAsPng}
            disabled={isExporting}
            className="w-full bg-white border-2 border-gray-200 text-gray-700 font-bold text-lg py-4 rounded-full flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <Camera size={20} />
            {isExporting ? 'Generating...' : 'Save as Image'}
          </button>
        </div>

      </div>
    </div>
  )
        }
      
