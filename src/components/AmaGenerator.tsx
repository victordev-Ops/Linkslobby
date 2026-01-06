'use client'

import { useState, useRef } from 'react'
import { toPng } from 'html-to-image'
import { useRouter } from 'next/navigation'
import { Share2, Download, Shuffle, Palette, ChevronLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Prompts to get people talking
const PROMPTS = [
  "Ask me anything!",
  "What's your honest opinion of me?",
  "Send me anonymous confessions",
  "Who do you ship me with? 🫣",
  "What's my red flag? 🚩",
  "Rate me 1-10",
  "Tell me a secret 🤫",
  "Advice for 2024?",
]

const GRADIENTS = [
  "bg-gradient-to-tr from-violet-600 to-indigo-600",
  "bg-gradient-to-tr from-rose-500 to-orange-500",
  "bg-gradient-to-tr from-emerald-500 to-teal-500",
  "bg-gradient-to-tr from-blue-500 to-cyan-500",
  "bg-gradient-to-tr from-fuchsia-600 to-pink-600",
  "bg-gradient-to-tr from-slate-900 to-slate-800",
]

export default function AmaGenerator({ username }: { username: string }) {
  const router = useRouter()
  const stickerRef = useRef<HTMLDivElement>(null)
  
  const [prompt, setPrompt] = useState(PROMPTS[0])
  const [colorIdx, setColorIdx] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleShuffle = () => {
    const random = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]
    setPrompt(random)
  }

  const handleColor = () => {
    setColorIdx((prev) => (prev + 1) % GRADIENTS.length)
  }

  const generateImage = async () => {
    if (!stickerRef.current) return null
    // Slight delay to ensure fonts render
    await document.fonts.ready
    
    return await toPng(stickerRef.current, { 
      cacheBust: true, 
      pixelRatio: 3, // High quality for Instagram
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
          text: `Ask me anything! 👉 say-app.com/confess/${username}`
        })
      } else {
        handleDownload() // Fallback
      }
    } catch (err) {
      console.error(err)
      toast.error("Could not share. Try saving instead.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (isGenerating) return
    setIsGenerating(true)
    try {
      const dataUrl = await generateImage()
      if (dataUrl) {
        const link = document.createElement('a')
        link.download = `ama-${username}.png`
        link.href = dataUrl
        link.click()
        toast.success("Image saved to photos!")
      }
    } catch (e) {
      toast.error("Failed to save image")
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
        <span className="font-bold text-gray-800">Create AMA Sticker</span>
        <div className="w-9" />
      </div>

      {/* PREVIEW AREA */}
      <div className="flex-1 flex flex-col items-center justify-center mb-8">
        
        {/* THIS DIV GETS CAPTURED */}
        <div ref={stickerRef} className="relative w-[300px] rounded-[2.5rem] overflow-hidden shadow-2xl bg-white border border-gray-200">
          {/* Header Gradient */}
          <div className={`h-24 ${GRADIENTS[colorIdx]} relative flex items-center justify-center overflow-hidden`}>
             <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 blur-xl rounded-full -mr-10 -mt-10"/>
             <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/30">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                   <img src="/logo.png" className="w-4 h-4 object-contain" alt="Logo" />
                </div>
                <span className="text-white font-bold text-sm tracking-wide">@{username}</span>
             </div>
          </div>

          {/* Question Body */}
          <div className="bg-white p-8 pt-6 pb-10 min-h-[160px] flex flex-col items-center text-center">
            <h2 className="text-2xl font-black text-gray-800 leading-tight mb-6">
              {prompt}
            </h2>
            
            {/* Fake Input Box */}
            <div className="w-full h-12 bg-gray-100 rounded-full flex items-center px-5 text-gray-400 text-sm font-medium">
              Type something...
            </div>
          </div>
        </div>

      </div>

      {/* CONTROLS */}
      <div className="w-full max-w-sm mx-auto space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <button onClick={handleShuffle} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <Shuffle className="text-purple-600" size={24} />
            <span className="text-xs font-bold text-gray-600">Shuffle Question</span>
          </button>
          
          <button onClick={handleColor} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <div className={`w-6 h-6 rounded-full ${GRADIENTS[(colorIdx + 1) % GRADIENTS.length]} border border-gray-100`} />
            <span className="text-xs font-bold text-gray-600">Change Color</span>
          </button>
        </div>

        <button 
          onClick={handleShare}
          disabled={isGenerating}
          className="w-full bg-black text-white font-bold text-lg py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70"
        >
          {isGenerating ? <Loader2 className="animate-spin" /> : <Share2 size={20} />}
          <span>Share to Story</span>
        </button>

        <p className="text-center text-xs text-gray-400 px-8">
          Tip: After sharing to your story, click the 🔗 icon to add your link so friends can reply!
        </p>
      </div>
    </div>
  )
  }
         
