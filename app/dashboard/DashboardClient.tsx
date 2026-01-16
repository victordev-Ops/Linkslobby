"use client"

import { useState, useEffect } from "react"
import { Copy, Check, MessageCircleQuestion, ChevronRight, Loader2, Share2, LayoutGrid, Lock, ChevronDown } from "lucide-react"
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
  const [confessCopied, setConfessCopied] = useState(false)
  const [isConfessOpen, setIsConfessOpen] = useState(false)
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

  const handleCopy = async (text: string, isHero: boolean) => {
    try {
      await navigator.clipboard.writeText(text)
      if (isHero) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        setConfessCopied(true)
        setTimeout(() => setConfessCopied(false), 2000)
      }
      toast.success("Link copied!")
    } catch (err) {
      toast.error("Failed to copy")
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FD]">
      {/* Navbar */}
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

      <main className="max-w-xl mx-auto px-4 py-8 space-y-8">
        
        {/* Hero Section */}
        <section className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100 text-center">
          <h1 className="text-2xl font-black text-slate-900 mb-1">
            Hey, {profile.username}! 👋
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            Share your link to start receiving messages.
          </p>

          <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl max-w-sm mx-auto">
            <div className="pl-3 text-slate-400 shrink-0">
              <Share2 size={16} />
            </div>
            <input 
              readOnly 
              value={confessUrl}
              className="flex-1 bg-transparent py-2 text-xs font-semibold text-slate-600 focus:outline-none truncate"
            />
            <button
              onClick={() => handleCopy(confessUrl, true)}
              className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 border-2 ${copied ? "bg-green-500 border-green-500 text-white" : "bg-transparent border-purple-600 text-purple-600 hover:bg-purple-50"}`}
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

          <div className="grid grid-cols-1 gap-3">
            {/* AMA Card */}
            <Link href="/ama" className="group">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all flex items-center gap-4 active:scale-[0.98]">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <MessageCircleQuestion size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-base">AMA Sticker</h3>
                  <p className="text-slate-400 text-xs line-clamp-1">Get a question sticker for your story</p>
                </div>
                <ChevronRight size={18} className="text-slate-300" />
              </div>
            </Link>

            {/* Refactored Confessions Card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => setIsConfessOpen(!isConfessOpen)}
                className="w-full p-4 flex items-center gap-4 active:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Lock size={22} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-bold text-slate-900 text-base">Confessions</h3>
                  <p className="text-slate-400 text-xs line-clamp-1">Receive anonymous secrets</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 transition-transform duration-300 ${isConfessOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Collapsible Content */}
              {isConfessOpen && (
                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 space-y-3">
                    <p className="text-[11px] text-purple-800 leading-relaxed font-medium">
                      Share this link on your Bio or Stories. Friends can send you secrets that only you can read. Their identity stays 100% hidden.
                    </p>
                    
                    <div className="flex items-center gap-2 p-1 bg-white border border-purple-200 rounded-xl">
                      <input 
                        readOnly 
                        value={confessUrl}
                        className="flex-1 bg-transparent px-2 text-[10px] font-bold text-slate-500 focus:outline-none truncate"
                      />
                      <button
                        onClick={() => handleCopy(confessUrl, false)}
                        className={`shrink-0 h-8 px-3 rounded-lg text-[10px] font-bold transition-all ${confessCopied ? 'bg-green-500 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                      >
                        {confessCopied ? 'COPIED' : 'COPY LINK'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-100/40 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex items-center justify-center text-slate-400">
                <p className="text-[10px] font-bold uppercase tracking-widest">More coming soon</p>
            </div>
          </div>
        </section>

        <footer className="text-center pt-2">
          <p className="text-[10px] text-slate-400 font-bold bg-white border border-slate-100 inline-block px-4 py-2 rounded-full shadow-sm">
            💡 TIP: ADD TO YOUR INSTA BIO
          </p>
        </footer>
      </main>
    </div>
  )
}



/*"use client"

import { useState, useEffect } from "react"
import { Copy, Check, MessageCircleQuestion, ChevronRight, Loader2, Share2, LayoutGrid, Lock } from "lucide-react"
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
    },
    {
      title: "Confessions",
      description: "Receive anonymous secrets and messages",
      icon: <Lock size={22} />,
      href: `/confess/${profile.slug}`,
      color: "text-purple-600",
      bg: "bg-purple-100"
    }
  ]

  return (
    <div className="min-h-screen bg-[#F8F9FD]">
      {/* Navbar */}
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

      <main className="max-w-xl mx-auto px-4 py-8 space-y-8">
        
        {/* Hero Section */}
        <section className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100 text-center">
          <h1 className="text-2xl font-black text-slate-900 mb-1">
            Hey, {profile.username}! 👋
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            Share your link to start receiving messages.
          </p>

          {/* Refactored Link Bar: Transparent BG for Button, Purple Border */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl max-w-sm mx-auto">
            <div className="pl-3 text-slate-400 shrink-0">
              <Share2 size={16} />
            </div>
            
            <input 
              readOnly 
              value={confessUrl}
              className="flex-1 bg-transparent py-2 text-xs font-semibold text-slate-600 focus:outline-none truncate"
            />

            <button
              onClick={handleCopy}
              aria-label="Copy Link"
              className={`
                shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 border-2
                ${copied 
                  ? "bg-green-500 border-green-500 text-white" 
                  : "bg-transparent border-purple-600 text-purple-600 hover:bg-purple-50"}
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

          <div className="grid grid-cols-1 gap-3">
            {games.map((game, idx) => (
              <Link key={idx} href={game.href} className="group">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all flex items-center gap-4 active:scale-[0.98]">
                  <div className={`w-12 h-12 shrink-0 rounded-xl ${game.bg} ${game.color} flex items-center justify-center`}>
                    {game.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base">{game.title}</h3>
                    <p className="text-slate-400 text-xs line-clamp-1">{game.description}</p>
                  </div>

                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              </Link>
            ))}

            <div className="bg-slate-100/40 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex items-center justify-center text-slate-400">
                <p className="text-[10px] font-bold uppercase tracking-widest">More coming soon</p>
            </div>
          </div>
        </section>

        <footer className="text-center pt-2">
          <p className="text-[10px] text-slate-400 font-bold bg-white border border-slate-100 inline-block px-4 py-2 rounded-full shadow-sm">
            💡 TIP: ADD TO YOUR INSTA BIO
          </p>
        </footer>

      </main>
    </div>
  )
}
