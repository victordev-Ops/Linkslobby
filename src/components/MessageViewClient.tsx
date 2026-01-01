// src/components/MessageViewClient.tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Share2, Lock, Camera, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image' // Import the image generator

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
  const cardRef = useRef<HTMLDivElement>(null) // 1. Create a Ref for the card
  
  const [isCopying, setIsCopying] = useState(false)
  const [isSaving, setIsSaving] = useState(false) // State for saving loading indicator

  const handleClose = () => {
    router.refresh()
    router.push('/inbox')
  }

  // 2. Logic to Save Image
  const handleSaveImage = async () => {
    if (cardRef.current === null) {
      return
    }

    setIsSaving(true)

    try {
      // Convert the specific DOM element to a PNG data URL
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true, // Prevents caching issues
        pixelRatio: 3,   // 3x resolution for high quality on Retina screens/Instagram
      })

      // Create a fake link to trigger the download
      const link = document.createElement('a')
      link.download = `confession-${confession.id}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Could not generate image', err)
      alert('Failed to save image. Please try screenshotting instead.')
    } finally {
      setIsSaving(false)
    }
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
      try {
        await navigator.clipboard.writeText(shareUrl)
        setIsCopying(true)
        setTimeout(() => setIsCopying(false), 2000)
      } catch (err) {
        console.error('Failed to copy', err)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-hidden font-sans">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-pink-100/50 to-transparent -z-10" />

      {/* Top Bar */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm">
            @
          </div>
          <span className="font-semibold text-gray-600">/inbox</span>
        </div>

        <button
          onClick={handleClose}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 active:scale-90 transition-transform"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
        
        <motion.div
          initial={{ scale: 1.15, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, duration: 0.6 }}
          className="w-full max-w-sm"
        >
          {/* 3. Attach the ref to this specific div only */}
          <div 
            ref={cardRef} 
            className="rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] bg-white border border-gray-100 transform transition-all"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 px-8 py-8 text-center relative">
              <h1 className="text-white text-lg font-bold tracking-wide drop-shadow-sm uppercase">
                Send me anonymous messages!
              </h1>
            </div>

            {/* Content Body */}
            <div className="px-8 py-14 min-h-[220px] flex items-center justify-center bg-white">
              <p className="text-center text-gray-800 font-bold text-2xl leading-relaxed break-words">
                {confession.message}
              </p>
            </div>
          </div>

          {/* Floating Actions */}
          <div className="flex justify-center gap-6 mt-8">
            <button className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 group-active:scale-95 transition-all text-2xl">
                🎨
              </div>
              <span className="text-xs font-medium text-gray-400">Color</span>
            </button>
            
            {/* 4. Updated Camera Button */}
            <button 
              onClick={handleSaveImage}
              disabled={isSaving}
              className="flex flex-col items-center gap-2 group"
            >
               <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 group-active:scale-95 transition-all text-xl">
                {isSaving ? (
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                ) : (
                  <Camera size={24} className="text-gray-700" />
                )}
              </div>
              <span className="text-xs font-medium text-gray-400">
                {isSaving ? 'Saving...' : 'Save'}
              </span>
            </button>
          </div>

        </motion.div>
      </div>

      {/* Bottom Action Sheet */}
      <div className="px-6 pb-10 space-y-4 z-10">
        <button className="w-full bg-red-50 border-2 border-red-100 text-red-500 py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          <Lock size={20} className="mb-1" />
          <span>Who sent this?</span>
        </button>

        <button
          onClick={handleReply}
          className="w-full bg-black text-white font-bold text-lg py-5 rounded-full shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform relative overflow-hidden"
        >
          {isCopying ? (
             <span>Link Copied! ✅</span>
          ) : (
            <>
              <Share2 size={20} />
              <span>Reply to Story</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
