"use client"

import { useState, useEffect } from "react"
import { Copy, Check, MessageCircleQuestion, ChevronRight, Loader2, Share2, LayoutGrid } from "lucide-react"
import { toast } from "sonner"
import Link from 'next/link'
import { useRouter } from "next/navigation" 
import { useAuth } from "@/context/AuthContext"
import XPBalance from "@/components/XPBalance"

// Define types for our game/feature cards
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
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xl italic">S</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Say</h2>
          </div>
          <XPBalance />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 md:py-12 space-y-10">
        
        {/* Hero Section */}
        <section className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
              Hey, {profile.username}! 👋
            </h1>
            <p className="text-slate-500 text-lg mb-8">
              Your inbox is ready. Share your link to start receiving anonymous messages.
            </p>

            {/* REFACTORED COMPACT LINK BAR */}
            <div className="max-w-md flex items-center gap-2 p-1.5 bg-slate-50 border-2 border-slate-100 rounded-2xl transition-all focus-within:border-purple-200 focus-within:bg-white group">
              <div className="pl-3 text-slate-400">
                <Share2 size={16} />
              </div>
              
              <input 
                readOnly 
                value={confessUrl}
                className="flex-1 bg-transparent py-2 px-1 text-sm font-semibold text-slate-600 focus:outline-none truncate"
              />

              <button
                onClick={handleCopy}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap
                  ${copied 
                    ? "bg-green-500 text-white" 
                    : "bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-100"}
                `}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Games Grid Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 px-2">
            <LayoutGrid size={20} className="text-purple-600" />
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Game Collection</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map((game, idx) => (
              <Link key={idx} href={game.href} className="group">
                <div className="h-full bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-purple-100 flex items-center gap-5">
                  <div className={`w-16 h-16 shrink-0 rounded-[1.25rem] ${game.bg} ${game.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    {game.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg mb-1">{game.title}</h3>
                    <p className="text-slate-500 text-sm leading-snug">{game.description}</p>
                  </div>

                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                    <ChevronRight size={20} />
                  </div>
                </div>
              </Link>
            ))}

            <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[2rem] p-6 flex items-center justify-center text-slate-400">
               <p className="text-sm font-bold italic tracking-wider">More games coming soon...</p>
            </div>
          </div>
        </section>

        {/* Footer Info */}
        <footer className="px-6 text-center">
          <p className="text-xs text-slate-400 font-medium bg-slate-100 inline-block px-4 py-2 rounded-full">
            💡 Pro tip: Add your link to your Instagram bio for 3x more messages!
          </p>
        </footer>

      </main>
    </div>
  )
}
