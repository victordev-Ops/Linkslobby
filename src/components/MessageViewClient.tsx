// src/components/MessageViewClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Share2, AlertTriangle, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'

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

  // Strip "message" keyword and cleanup whitespace
  const finalMessage = confession.message
    .replace(/^(message|Message)[:\s-]*/, '')
    .trim()

  const handleClose = () => {
    router.refresh()
    router.push('/inbox')
  }

  const handleReport = () => {
    // Logic for reporting (e.g., opening a modal or API call)
    alert("Message reported. Thank you for keeping the community safe.")
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
      } catch (err) { console.log(err) }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] flex flex-col items-center justify-between py-10 px-6 overflow-hidden">
      
      {/* 1. Header Navigation - Fast Fade X */}
      <div className="w-full max-w-md flex justify-between items-center z-50">
        <div className="w-10" /> {/* Spacer for centering */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }} // Fast fade as requested
          onClick={handleClose}
          className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-90 transition-transform"
        >
          <X size={24} className="text-gray-400" />
        </motion.button>
      </div>

      {/* 2. The Message Card (Target for HTML-to-PNG) */}
      <motion.div
        id="message-card" 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-gray-100 flex flex-col"
      >
        {/* Card Header with Report Icon */}
        <div className="bg-gradient-to-r from-rose-500 to-orange-400 p-6 flex justify-between items-center">
          <span className="text-white/80 font-bold tracking-widest text-xs uppercase ml-4">
            Send me anonymous messages!
          </span>
          <button 
            onClick={handleReport}
            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
            title="Report Message"
          >
            <ShieldAlert size={20} className="text-white/70 group-hover:text-white" />
          </button>
        </div>

        {/* Message Body - Optimized for 1000 characters */}
        <div className="p-10 flex flex-col items-center justify-center min-h-[300px] max-h-[500px]">
          <div className="w-full overflow-y-auto custom-scrollbar px-2">
            <p className="text-center text-2xl md:text-3xl font-semibold text-gray-800 leading-snug break-words">
              {finalMessage}
            </p>
          </div>
        </div>

        {/* Card Footer Branding */}
        <div className="pb-8 flex justify-center items-center gap-2 opacity-20">
          <div className="h-[1px] w-8 bg-black" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Secret Message</span>
          <div className="h-[1px] w-8 bg-black" />
        </div>
      </motion.div>

      {/* 3. Action Area - Stable bottom positioning */}
      <div className="w-full max-w-md space-y-4">
        <button
          onClick={handleReply}
          className="w-full bg-black text-white py-5 rounded-3xl font-bold text-lg shadow-xl hover:bg-gray-900 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          {copied ? 'Link Copied!' : 'Reply on Story'}
          <Share2 size={20} />
        </button>
        
        <p className="text-center text-gray-400 text-xs font-medium uppercase tracking-widest">
          Step 1: Copy Link • Step 2: Share to Story
        </p>
      </div>

      {/* Background Decor - Visual only */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 opacity-40 pointer-events-none">
        <div className="absolute top-0 left-0 w-64 h-64 bg-rose-200 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-orange-200 rounded-full blur-[100px]" />
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
      `}</style>
    </div>
  )
            }
          
