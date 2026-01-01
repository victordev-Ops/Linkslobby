
// src/components/MessageViewClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Share2, Copy, Camera } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Helper for conditional classes
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
  const [copied, setCopied] = useState(false)

  // 1. Clean the message text
  // This removes "message" or "Message" if it appears at the start of the string
  const cleanMessageText = (text: string) => {
    return text.replace(/^(message|Message)[:\s-]*/, '').trim()
  }

  const finalMessage = cleanMessageText(confession.message)

  const handleClose = () => {
    // Force refresh to update "read" status in the inbox
    router.refresh()
    router.push('/inbox')
  }

  const handleReply = async () => {
    const shareUrl = `${window.location.origin}/confess/${username}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Send me anonymous messages!',
          text: 'Tap to send me a message anonymously',
          url: shareUrl,
        })
      } catch (err) {
        console.log('Share cancelled', err)
      }
    } else {
      // Fallback for desktop
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy', err)
      }
    }
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-400/30 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-orange-400/30 rounded-full blur-[100px] pointer-events-none" />

      {/* Close Button - Floating Top Right */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        onClick={handleClose}
        className="absolute top-6 right-6 p-3 bg-white/80 backdrop-blur-md rounded-full shadow-sm hover:bg-white transition-colors z-50 group"
      >
        <X size={24} className="text-gray-600 group-hover:text-red-500 transition-colors" />
      </motion.button>

      {/* Main Content Container */}
      <div className="w-full max-w-md px-6 z-10 flex flex-col items-center gap-8">
        
        {/* THE CARD: Zoom/Pop Animation Effect */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 20,
            duration: 0.6
          }}
          className="w-full"
        >
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/50">
            
            {/* Gradient Header */}
            <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-8 text-center relative overflow-hidden">
               {/* Subtle grain or pattern overlay could go here */}
               <div className="relative z-10">
                 <h2 className="text-white font-black text-lg uppercase tracking-widest opacity-90">
                   Anonymous
                 </h2>
               </div>
            </div>

            {/* Message Body */}
            <div className="px-8 py-12 min-h-[200px] flex items-center justify-center bg-white">
              <p className="text-center text-3xl md:text-4xl font-bold text-gray-800 leading-tight">
                {finalMessage}
              </p>
            </div>

            {/* Footer Branding (Optional aesthetic touch) */}
            <div className="pb-6 flex justify-center opacity-30">
                <div className="flex gap-2 text-2xl grayscale">
                   <span>📸</span><span>💬</span>
                </div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          className="w-full space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {/* Main Call to Action */}
          <button
            onClick={handleReply}
            className="w-full group relative overflow-hidden bg-black text-white font-bold text-xl py-5 rounded-full shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-3"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-black opacity-100 group-hover:opacity-90 transition-opacity" />
            <span className="relative z-10 flex items-center gap-2">
              {copied ? 'Link Copied! ✅' : 'Reply on Story'} 
              {!copied && <Share2 size={22} />}
            </span>
          </button>
          
          <div className="text-center">
            <p className="text-gray-500 text-sm font-medium">
              Tap to generate a reply link
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  )
  }
