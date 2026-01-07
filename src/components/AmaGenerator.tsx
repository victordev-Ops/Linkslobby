'use client'

import { useState, useRef } from 'react'
import { toPng } from 'html-to-image'
import { useRouter } from 'next/navigation'
import { Share2, Shuffle, ChevronLeft, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext' // Import the hook

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
  "bg-gradient-to-tr from-violet-600 to-indigo-600",
  "bg-gradient-to-tr from-rose-500 to-orange-500",
  "bg-gradient-to-tr from-emerald-500 to-teal-500",
  "bg-gradient-to-tr from-blue-500 to-cyan-500",
  "bg-gradient-to-tr from-fuchsia-600 to-pink-600",
  "bg-gradient-to-tr from-slate-900 to-slate-800",
]

export default function AmaGenerator() {
  const router = useRouter()
  const { profile, loading } = useAuth() // Get profile from context
  const stickerRef = useRef<HTMLDivElement>(null)
  
  const [prompt, setPrompt] = useState(PROMPTS[0])
  const [colorIdx, setColorIdx] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // Wait for profile to load to prevent "undefined" in URL
  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-purple-600" size={32} />
      </div>
    )
  }

  const shareUrl = `https://say-app.vercel.app/ama/${profile.slug}`

  const handleShuffle = () => {
    const random = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]
    setPrompt(random)
  }

  const handleColor = () => setColorIdx((prev) => (prev + 1) % GRADIENTS.length)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("Link copied! Use this in your Link Sticker.")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy link")
    }
  }

  const generateImage = async () => {
    if (!stickerRef.current) return null
    await document.fonts.ready
    return await toPng(stickerRef.current, { 
      cacheBust: true, 
      pixelRatio: 3,
      style: { transform: 'scale(1)' } 
    })
  }

  const handleShare = async () => {
    if (isGenerating) return
    setIsGenerating(true)

    try {
      const dataUrl = await generateImage()
      if (!dataUrl) throw new Error("Failed to generate")

      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'ama-sticker.png', { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Ask Me Anything',
          text: `Ask me anything anonymously! 👇`,
          url: shareUrl
        })
      } else {
        const link = document.createElement('a')
        link.download = `ama-${profile.username}.png`
        link.href = dataUrl
        link.click()
        handleCopyLink()
      }
    } catch (err) {
      toast.error("Could not share. Image saved to gallery.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 pt-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <span className="font-bold text-gray-800">AMA Sticker</span>
        <div className="w-9" />
      </div>

      {/* Sticker Preview */}
      <div className="flex-1 flex flex-col items-center justify-center mb-8">
        <div ref={stickerRef} className="relative w-[300px] rounded-[2.5rem] overflow-hidden shadow-2xl bg-white border border-gray-200">
          <div className={`h-24 ${GRADIENTS[colorIdx]} relative flex items-center justify-center overflow-hidden`}>
             <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/30">
                <span className="text-white font-bold text-sm">@{profile.username}</span>
             </div>
          </div>
          <div className="bg-white p-8 pt-6 pb-10 min-h-[160px] flex flex-col items-center text-center">
            <h2 className="text-2xl font-black text-gray-800 leading-tight mb-6">{prompt}</h2>
            <div className="w-full h-12 bg-gray-100 rounded-full flex items-center px-5 text-gray-400 text-sm font-medium">
              Type something...
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-sm mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleShuffle} className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col items-center gap-1 active:scale-95 transition-transform">
            <Shuffle className="text-purple-600" size={20} />
            <span className="text-[10px] font-bold uppercase text-gray-500">Shuffle</span>
          </button>
          <button onClick={handleColor} className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col items-center gap-1 active:scale-95 transition-transform">
            <div className={`w-5 h-5 rounded-full ${GRADIENTS[(colorIdx + 1) % GRADIENTS.length]}`} />
            <span className="text-[10px] font-bold uppercase text-gray-500">Color</span>
          </button>
        </div>

        {/* Copy Link Section */}
        <button 
          onClick={handleCopyLink}
          className="w-full bg-white border-2 border-dashed border-gray-200 p-4 rounded-2xl flex items-center justify-between group"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center">
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-500" />}
            </div>
            <div className="text-left truncate">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Your URL</p>
              <p className="text-sm font-mono text-gray-600 truncate">{shareUrl}</p>
            </div>
          </div>
          <span className="text-xs font-bold text-purple-600 flex-shrink-0 ml-2">{copied ? "Copied!" : "Copy"}</span>
        </button>

        <button 
          onClick={handleShare}
          disabled={isGenerating}
          className="w-full bg-black text-white font-bold text-lg py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
        >
          {isGenerating ? <Loader2 className="animate-spin" /> : <Share2 size={22} />}
          <span>Share to Story</span>
        </button>
      </div>
    </div>
  )
}
