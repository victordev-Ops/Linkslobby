'use client'

import { useState, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { useRouter } from 'next/navigation'
import { Share2, Shuffle, ChevronLeft, Loader2, Copy, Check, Palette } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'

const PROMPTS = [
  "Ask me anything!",
  "What's your honest opinion of me?",
  "Send me anonymous confessions",
  "Who do you ship me with? 🫣",
  "What's my red flag? 🚩",
  "Rate me 1-10",
  "Tell me a secret 🤫",
  "Advice for 2026?",
]

const GRADIENTS = [
  "linear-gradient(to top right, #7c3aed, #4f46e5)", // Violet to Indigo
  "linear-gradient(to top right, #f43f5e, #f97316)", // Rose to Orange
  "linear-gradient(to top right, #10b981, #14b8a6)", // Emerald to Teal
  "linear-gradient(to top right, #3b82f6, #06b6d4)", // Blue to Cyan
  "linear-gradient(to top right, #d946ef, #db2777)", // Fuchsia to Pink
  "linear-gradient(to top right, #0f172a, #1e293b)", // Slate 900 to 800
]

export default function AmaGenerator() {
  const router = useRouter()
  const { profile, loading } = useAuth()
  const stickerRef = useRef<HTMLDivElement>(null)
  
  const [prompt, setPrompt] = useState(PROMPTS[0])
  const [colorIdx, setColorIdx] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // 1. Dynamic URL Construction
  const shareUrl = profile ? `https://say-app.vercel.app/ama/${profile.slug}` : ''

  const handleShuffle = () => {
    const remaining = PROMPTS.filter(p => p !== prompt)
    const random = remaining[Math.floor(Math.random() * remaining.length)]
    setPrompt(random)
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("Link copied! Use the 'Link' sticker in Instagram.")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy link")
    }
  }

  const handleShare = async () => {
    if (isGenerating || !stickerRef.current) return
    setIsGenerating(true)

    try {
      // Ensure fonts are loaded before taking the "snapshot"
      await document.fonts.ready

      const dataUrl = await toPng(stickerRef.current, { 
        cacheBust: true, 
        pixelRatio: 3, // High quality for retina displays
        backgroundColor: '#f9fafb', // Match gray-50
      })

      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `ama-${profile?.username}.png`, { type: 'image/png' })

      // Check if Web Share API supports files
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'AMA Sticker',
          text: `Ask me anything!`,
        })
      } else {
        // Fallback for browsers that don't support file sharing
        const link = document.createElement('a')
        link.download = `ama-sticker.png`
        link.href = dataUrl
        link.click()
        toast.info("Image downloaded! Copy the link to share.")
        handleCopyLink()
      }
    } catch (err) {
      console.error("Share error:", err)
      toast.error("Failed to generate image. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-purple-600" size={32} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-gray-600 mb-4">Please log in to create an AMA sticker.</p>
        <button onClick={() => router.push('/login')} className="bg-purple-600 text-white px-6 py-2 rounded-xl">Login</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 pt-6 pb-20 max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <button 
          onClick={() => router.back()} 
          className="p-2 bg-white rounded-full shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-90 transition-all"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="font-bold text-gray-800">AMA Sticker</h1>
        <div className="w-9" /> {/* Spacer */}
      </header>

      {/* Sticker Preview Area */}
      <div className="flex-1 flex flex-col items-center justify-center mb-8">
        <div 
          ref={stickerRef} 
          className="relative w-[300px] rounded-[2.5rem] overflow-hidden shadow-2xl bg-white border border-gray-200"
        >
          {/* Top Gradient Header */}
          <div 
            style={{ background: GRADIENTS[colorIdx] }} 
            className="h-24 relative flex items-center justify-center"
          >
             <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/30">
                <span className="text-white font-bold text-sm">@{profile.username}</span>
             </div>
          </div>

          {/* Prompt Body */}
          <div className="bg-white p-8 pt-6 pb-10 min-h-[160px] flex flex-col items-center text-center">
            <h2 className="text-2xl font-black text-gray-800 leading-tight mb-6">
              {prompt}
            </h2>
            <div className="w-full h-12 bg-gray-100 rounded-full flex items-center px-5 text-gray-400 text-sm font-medium">
              Type something...
            </div>
          </div>
        </div>
      </div>

      {/* Controls Grid */}
      <div className="w-full space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={handleShuffle} 
            className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col items-center gap-1 active:scale-95 transition-transform hover:bg-gray-50"
          >
            <Shuffle className="text-purple-600" size={20} />
            <span className="text-[10px] font-bold uppercase text-gray-500">Shuffle</span>
          </button>
          <button 
            onClick={() => setColorIdx((prev) => (prev + 1) % GRADIENTS.length)} 
            className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col items-center gap-1 active:scale-95 transition-transform hover:bg-gray-50"
          >
            <Palette className="text-purple-600" size={20} />
            <span className="text-[10px] font-bold uppercase text-gray-500">Color</span>
          </button>
        </div>

        {/* Copy Link Section */}
        <button 
          onClick={handleCopyLink}
          className="w-full bg-white border-2 border-dashed border-gray-200 p-4 rounded-2xl flex items-center justify-between group hover:border-purple-300 transition-colors"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center">
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-500" />}
            </div>
            <div className="text-left truncate">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Your Share URL</p>
              <p className="text-sm font-mono text-gray-600 truncate">{shareUrl}</p>
            </div>
          </div>
          <span className="text-xs font-bold text-purple-600 flex-shrink-0 ml-2">
            {copied ? "Copied!" : "Copy"}
          </span>
        </button>

        {/* Primary Action Button */}
        <button 
          onClick={handleShare}
          disabled={isGenerating}
          className="w-full bg-black text-white font-bold text-lg py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:bg-gray-400"
        >
          {isGenerating ? <Loader2 className="animate-spin" /> : <Share2 size={22} />}
          <span>Share to Story</span>
        </button>
      </div>
    </div>
  )
}
