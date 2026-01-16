"use client"

import { useState, useEffect } from "react"
import { Copy, Check, MessageCircleQuestion, ChevronRight, Loader2, Share2, LayoutGrid } from "lucide-react"
import { toast } from "sonner"
import Link from 'next/link'
import { useRouter } from "next/navigation" 
import { useAuth } from "@/context/AuthContext"
import XPBalance from "@/components/XPBalance"

type GameCard = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  bg: string;
}

export default function DashboardClient() {
  const { user, profile, loading } = useAuth()
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
      } else if (!profile) {
        router.push('/auth/setup')
      }
    }
  }, [user, profile, loading, router])

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  const confessUrl = `https://say-app.vercel.app/confess/${profile.slug}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(confessUrl)
      setCopied(true)
      toast.success("Link copied!")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy")
    }
  }

  const games: GameCard[] = [
    {
      title: "AMA Sticker",
      description: "Get a question sticker for your Instagram story",
      icon: <MessageCircleQuestion size={24} />,
      href: "/ama",
      color: "text-orange-600",
      bg: "bg-orange-100"
    }
  ]

  return (
    <div className="min-h-screen bg-[#F8F9FD]">
      {/* Navbar - Tighter padding for mobile */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-lg italic">S</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Say</h2>
          </div>
          <XPBalance />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-8">
        
        {/* Hero Section - Optimized for Mobile First */}
        <section className="bg-white rounded-[2rem] p-6 md:p-10 shadow-sm border border-slate-100 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-1">
            Hey, {profile.username}! 👋
          </h1>
          <p className="text-slate-500 text-sm md:text-base mb-6">
            Share your link to start receiving messages.
          </p>

          {/* Refactored Compact Action Bar */}
          <div className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-200 rounded-xl max-w-sm mx-auto md:mx-0">
            <div className="pl-3 text-slate-400 shrink-0">
              <Share2 size={16} />
            </div>
            
            <input 
              readOnly 
              value={confessUrl}
              className="flex-1 bg-transparent py-2 text-xs font-medium text-slate-600 focus:outline-none truncate"
            />

            <button
              onClick={handleCopy}
              aria-label="Copy Link"
              className={`
                shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-all active:scale-90
                ${copied 
                  ? "bg-green-500 text-white" 
                  : "bg-purple-600 text-white shadow-sm"}
              `}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </section>

        {/* Games Grid Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <LayoutGrid size={18} className="text-purple-600" />
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Game Collection</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {games.map((game, idx) => (
              <Link key={idx} href={game.href} className="group">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all flex items-center gap-4 active:bg-slate-50">
                  <div className={`w-12 h-12 shrink-0 rounded-xl ${game.bg} ${game.color} flex items-center justify-center`}>
                    {game.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base">{game.title}</h3>
                    <p className="text-slate-500 text-xs line-clamp-1">{game.description}</p>
                  </div>

                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              </Link>
            ))}

            <div className="bg-slate-100/50 border border-dashed border-slate-200 rounded-2xl p-4 flex items-center justify-center text-slate-400">
               <p className="text-xs font-bold italic">More coming soon...</p>
            </div>
          </div>
        </section>

        <footer className="text-center pt-4">
          <p className="text-[10px] text-slate-400 font-medium bg-slate-100 inline-block px-3 py-1.5 rounded-full">
            💡 Pro tip: Put this link in your Bio!
          </p>
        </footer>

      </main>
    </div>
  )
}
