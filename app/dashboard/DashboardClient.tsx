"use client"

import { useState, useEffect } from "react"
import {
  Copy, Check, MessageCircleQuestion, Loader2, Share2,
  LayoutGrid, Lock, ChevronDown, Brain, X, Save,
  Dices, Sparkles, Flame, Swords, Plus
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { createClient } from "@/lib/supabase/client"
import { useScrollLock } from "@/hooks/useScrollLock"
import VerifiedBadge from "@/components/VerifiedBadge"
import Link from "next/link"

interface DashboardClientProps {
  initialDykmQuestions?: any[]
  serverProfile?: any
}

export default function DashboardClient({ initialDykmQuestions, serverProfile }: DashboardClientProps) {
  const { user: authUser, profile: authProfile, loading: authLoading } = useAuth()
  const [supabase] = useState(() => createClient())

  const profile = serverProfile || authProfile
  const loading = !profile && authLoading

  // Link States
  const [dykmCopied, setDykmCopied] = useState(false)
  const [amaCopied, setAmaCopied] = useState(false)
  const [confessCopied, setConfessCopied] = useState(false)
  const [hotSeatCopied, setHotSeatCopied] = useState(false)
  const [anonymousCopied, setAnonymousCopied] = useState(false)

  // Accordion States (Expanded by default constraint)
  const [isAmaOpen, setIsAmaOpen] = useState(true)
  const [isConfessOpen, setIsConfessOpen] = useState(true)
  const [isDykmOpen, setIsDykmOpen] = useState(true)
  const [isTodOpen, setIsTodOpen] = useState(true)
  const [isHotSeatOpen, setIsHotSeatOpen] = useState(true)
  const [isRpsOpen, setIsRpsOpen] = useState(true)
  const [isAnonymousOpen, setIsAnonymousOpen] = useState(true)

  // Navigation States
  const [isNavigatingToTod, setIsNavigatingToTod] = useState(false)
  const [isNavigatingToHotSeat, setIsNavigatingToHotSeat] = useState(false)
  const [isNavigatingToRps, setIsNavigatingToRps] = useState(false)

  // DYKM Logic
  const [hasDykm, setHasDykm] = useState(!!initialDykmQuestions)
  const [isDykmModalOpen, setIsDykmModalOpen] = useState(false)
  useScrollLock(isDykmModalOpen)
  const [isSavingDykm, setIsSavingDykm] = useState(false)
  const [dykmQuestions, setDykmQuestions] = useState(initialDykmQuestions || [
    { question: "", hint: "", answer: "" },
    { question: "", hint: "", answer: "" },
    { question: "", hint: "", answer: "" },
  ])

  const router = useRouter()

  useEffect(() => {
    if (!loading && !profile) {
      router.push('/login')
    }
  }, [profile, loading, router])

  const handleSaveDykm = async () => {
    if (dykmQuestions.some((q: any) => !q.question || !q.answer)) {
      toast.error("Please fill in all questions and answers")
      return
    }

    setIsSavingDykm(true)
    try {
      const { error } = await supabase.from('dykm_quizzes').upsert({
        user_id: profile?.id,
        questions: dykmQuestions
      })

      if (error) throw error

      toast.success("Quiz saved successfully!")
      setHasDykm(true)
      setIsDykmModalOpen(false)
    } catch (err) {
      toast.error("Failed to save quiz")
    } finally {
      setIsSavingDykm(false)
    }
  }

  const handleNavigateToTod = () => {
    setIsNavigatingToTod(true)
    router.push('/tod')
  }

  const handleNavigateToHotSeat = () => {
    setIsNavigatingToHotSeat(true)
    router.push('/hot-seat')
  }

  const handleNavigateToRps = () => {
    setIsNavigatingToRps(true)
    router.push('/rps')
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    )
  }

  const amaUrl = `https://linkslobby.vercel.app/ama/${profile.slug}`
  const confessUrl = `https://linkslobby.vercel.app/confess/${profile.slug}`
  const dykmUrl = `https://linkslobby.vercel.app/dykm/${profile.slug}`
  const anonymousUrl = `https://linkslobby.vercel.app/anonymous/${profile.slug}`
  const hotSeatUrl = `https://linkslobby.vercel.app/hot-seat/${profile.slug}`

  const handleCopy = async (text: string, type: 'hero' | 'ama' | 'confess' | 'dykm' | 'hotSeat' | 'anonymous') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'ama') { setAmaCopied(true); setTimeout(() => setAmaCopied(false), 2000) }
      else if (type === 'confess') { setConfessCopied(true); setTimeout(() => setConfessCopied(false), 2000) }
      else if (type === 'dykm') { setDykmCopied(true); setTimeout(() => setDykmCopied(false), 2000) }
      else if (type === 'hotSeat') { setHotSeatCopied(true); setTimeout(() => setHotSeatCopied(false), 2000) }
      else if (type === 'anonymous') { setAnonymousCopied(true); setTimeout(() => setAnonymousCopied(false), 2000) }
      toast.success("Link copied!")
    } catch (err) {
      toast.error("Failed to copy")
    }
  }

  const handleNativeShare = async (url: string, title: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ url, title })
      } else {
        await handleCopy(url, 'hero')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error("Failed to share")
      }
    }
  }

  return (
    {/* Applied modern gaming font families constraints via style or arbitrary class */}
    <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24 font-['Poppins',_'Nunito',_sans-serif]">

      <div className="fixed inset-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Navbar: Updated App Name to LinksLobby & Optimized Star Balance */}
      <nav className={`bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 sticky top-0 z-30 transition-all duration-200 ${isDykmModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <span className="text-white font-black text-xl italic">L</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">LinksLobby</h2>
          </div>
          
          {/* Optimized Star Balance UI */}
          <button className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-500/20 px-3 py-1.5 rounded-full cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-sm">
            <Sparkles size={16} className="text-amber-500" />
            <span className="font-black text-amber-600 dark:text-amber-400 text-sm">1,250</span>
            <div className="bg-amber-500 rounded-full w-4 h-4 flex items-center justify-center ml-1 shadow-inner">
              <Plus size={12} className="text-white" strokeWidth={4} />
            </div>
          </button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-8 relative z-10">

        <header className="py-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-2">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-12 h-12 rounded-full object-cover ring-4 ring-purple-500/20 shadow-xl"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-xl ring-4 ring-purple-500/20 shadow-xl">
                {profile.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}

            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 leading-none">
              Hi, {profile.username?.split(' ')[0]}
              {profile.is_pro
                ? <VerifiedBadge size={24} />
                : <Link href="/upgrade" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-600 transition">
                    <VerifiedBadge size={24} /> Get Verified
                  </Link>
              }
            </h1>
          </div>
          
          <p className="text-slate-500 dark:text-white/60 text-base font-medium">
            Ready to break the ice today? Pick a game below! 🎮
          </p>
        </header>

        {/* Game Collection Section */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 px-2">
            <LayoutGrid size={18} className="text-purple-600 dark:text-purple-400" />
            <h2 className="text-[11px] font-black text-slate-400 dark:text-white/40 uppercase tracking-[0.25em]">Game Collection</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            
            {/* Anonymous Link Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
              <div
                onClick={() => setIsAnonymousOpen(!isAnonymousOpen)}
                className="p-5 flex items-center gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Share2 size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">Anonymous Inbox</h3>
                  <p className="text-slate-500 dark:text-white/60 text-sm font-medium line-clamp-1">Get unfiltered messages from friends</p>
                </div>
                <ChevronDown size={20} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isAnonymousOpen ? "rotate-180" : ""}`} />
              </div>

              {isAnonymousOpen && (
                <div className="px-5 pb-6 pt-0 space-y-4 animate-in slide-in-from-top-4 duration-300 fade-in">
                  <div className="p-4 bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-500/10 dark:to-transparent rounded-2xl border-l-4 border-indigo-500">
                    <p className="text-sm text-indigo-800 dark:text-indigo-200 font-semibold leading-relaxed">
                      🤫 Drop this link in your bio and let the secret messages roll in!
                    </p>
                  </div>

                  <div className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
                    <input
                      readOnly
                      value={anonymousUrl}
                      className="flex-1 bg-transparent pl-4 py-2 text-xs font-bold text-slate-500 dark:text-white/60 focus:outline-none truncate"
                    />
                    <button
                      onClick={() => handleCopy(anonymousUrl, 'anonymous')}
                      className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 border ${anonymousCopied ? "bg-green-500 border-green-500 text-white" : "bg-white dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 shadow-sm"}`}
                    >
                      {anonymousCopied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <button
                      onClick={() => handleNativeShare(anonymousUrl, 'Send me an anonymous message!')}
                      className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 active:scale-90 bg-white dark:bg-white/10 shadow-sm"
                    >
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Truth or Dare Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
              <div
                onClick={() => setIsTodOpen(!isTodOpen)}
                className="p-5 flex items-center gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Dices size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-slate-900 dark:text-white text-lg">Truth or Dare</h3>
                    <div className="relative flex items-center">
                      <span className="absolute -left-1 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                      <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg shadow-rose-500/30">Live</span>
                    </div>
                  </div>
                  <p className="text-slate-500 dark:text-white/60 text-sm font-medium line-clamp-1">Spin the bottle! Dare friends or hear truths.</p>
                </div>
                <ChevronDown size={20} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isTodOpen ? "rotate-180" : ""}`} />
              </div>

              {isTodOpen && (
                <div className="px-5 pb-6 pt-0 space-y-4 animate-in slide-in-from-top-4 duration-300 fade-in">
                  <div className="p-4 bg-gradient-to-r from-rose-50 to-transparent dark:from-rose-500/10 dark:to-transparent rounded-2xl border-l-4 border-rose-500">
                    <p className="text-sm text-rose-800 dark:text-rose-200 font-semibold leading-relaxed">
                      🔥 Drop the link, invite the squad, and take turns surviving crazy dares or spilling secrets!
                    </p>
                  </div>

                  <button
                    onClick={handleNavigateToTod}
                    disabled={isNavigatingToTod}
                    className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl text-sm hover:bg-rose-700 transition-all active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2 shadow-xl shadow-rose-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isNavigatingToTod ? <Loader2 size={18} className="animate-spin" /> : <Dices size={18} />}
                    {isNavigatingToTod ? 'Entering Lobby...' : 'Join the Fun'}
                  </button>
                </div>
              )}
            </div>

            {/* DYKM Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
              <div
                onClick={() => setIsDykmOpen(!isDykmOpen)}
                className="p-5 flex items-center gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Brain size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">Do You Know Me?</h3>
                  <p className="text-slate-500 dark:text-white/60 text-sm font-medium line-clamp-1">The ultimate friendship test</p>
                </div>
                <ChevronDown size={20} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isDykmOpen ? "rotate-180" : ""}`} />
              </div>

              {isDykmOpen && (
                <div className="px-5 pb-6 pt-0 space-y-4 animate-in slide-in-from-top-4 duration-300 fade-in">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-500/10 dark:to-transparent rounded-2xl border-l-4 border-blue-500">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold leading-relaxed">
                      🧠 Think they know you? Craft 3 questions and test their loyalty! 
                    </p>
                  </div>

                  {!hasDykm ? (
                    <button
                      onClick={() => setIsDykmModalOpen(true)}
                      className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl text-sm hover:bg-blue-700 transition-all active:scale-95 hover:scale-[1.02] shadow-xl shadow-blue-500/20"
                    >
                      Craft Your Quiz
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
                        <input
                          readOnly
                          value={dykmUrl}
                          className="flex-1 bg-transparent pl-4 py-2 text-xs font-bold text-slate-500 dark:text-white/60 focus:outline-none truncate"
                        />
                        <button
                          onClick={() => handleCopy(dykmUrl, 'dykm')}
                          className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 border ${dykmCopied ? "bg-green-500 border-green-500 text-white" : "bg-white dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 shadow-sm"}`}
                        >
                          {dykmCopied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                        <button
                          onClick={() => handleNativeShare(dykmUrl, 'How well do you know me? Take the quiz!')}
                          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 active:scale-90 bg-white dark:bg-white/10 shadow-sm"
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                      <button
                        onClick={() => setIsDykmModalOpen(true)}
                        className="w-full py-3 border-2 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/80 font-bold rounded-2xl text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95 hover:scale-[1.02]"
                      >
                        Edit Questions
                     </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AMA Sticker Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
              <div
                onClick={() => setIsAmaOpen(!isAmaOpen)}
                className="p-5 flex items-center gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <MessageCircleQuestion size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">Ask Me Anything </h3>
                  <p className="text-slate-500 dark:text-white/60 text-sm font-medium line-clamp-1">Let them ask, you answer</p>
                </div>
                <ChevronDown size={20} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isAmaOpen ? "rotate-180" : ""}`} />
              </div>

              {isAmaOpen && (
                <div className="px-5 pb-6 pt-0 space-y-4 animate-in slide-in-from-top-4 duration-300 fade-in">
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-500/10 dark:to-transparent rounded-2xl border-l-4 border-orange-500">
                    <p className="text-sm text-orange-800 dark:text-orange-200 font-semibold leading-relaxed">
                      🎤 Put yourself in the spotlight! Let your friends ask you anything anonymously.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
                    <input
                      readOnly
                      value={amaUrl}
                      className="flex-1 bg-transparent pl-4 py-2 text-xs font-bold text-slate-500 dark:text-white/60 focus:outline-none truncate"
                    />
                    <button
                      onClick={() => handleCopy(amaUrl, 'ama')}
                      className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 border ${amaCopied ? "bg-green-500 border-green-500 text-white" : "bg-white dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 shadow-sm"}`}
                    >
                      {amaCopied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <button
                      onClick={() => handleNativeShare(amaUrl, 'Ask Me Anything anonymously!')}
                      className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 active:scale-90 bg-white dark:bg-white/10 shadow-sm"
                    >
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
                  
            {/* Confessions Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
              <div
                onClick={() => setIsConfessOpen(!isConfessOpen)}
                className="p-5 flex items-center gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Lock size={26} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">Confessions</h3>
                  <p className="text-slate-500 dark:text-white/60 text-sm font-medium line-clamp-1">Unlock the secret vault</p>
                </div>
                <ChevronDown size={20} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isConfessOpen ? "rotate-180" : ""}`} />
              </div>

              {isConfessOpen && (
                <div className="px-5 pb-6 pt-0 space-y-4 animate-in slide-in-from-top-4 duration-300 fade-in">
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-500/10 dark:to-transparent rounded-2xl border-l-4 border-purple-500">
                    <p className="text-sm text-purple-800 dark:text-purple-200 font-semibold leading-relaxed">
                      🔐 Unlock the vault. Receive anonymous secrets and confessions safely.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
                    <input
                      readOnly
                      value={confessUrl}
                      className="flex-1 bg-transparent pl-4 py-2 text-xs font-bold text-slate-500 dark:text-white/60 focus:outline-none truncate"
                    />
                    <button
                      onClick={() => handleCopy(confessUrl, 'confess')}
                      className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 border ${confessCopied ? "bg-green-500 border-green-500 text-white" : "bg-white dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 shadow-sm"}`}
                    >
                      {confessCopied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <button
                      onClick={() => handleNativeShare(confessUrl, 'Send me a secret confession!')}
                      className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 active:scale-90 bg-white dark:bg-white/10 shadow-sm"
                    >
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
                 {/* Hot Seat Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
              <div
                onClick={() => setIsHotSeatOpen(!isHotSeatOpen)}
                className="p-5 flex items-center gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Flame size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-slate-900 dark:text-white text-lg">Hot Seat</h3>
                    <div className="relative flex items-center">
                      <span className="absolute -left-1 w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                      <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg shadow-amber-500/30">Live</span>
                    </div>
                  </div>
                  <p className="text-slate-500 dark:text-white/60 text-sm font-medium line-clamp-1">Face the ultimate interrogation</p>
                </div>
                <ChevronDown size={20} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isHotSeatOpen ? "rotate-180" : ""}`} />
              </div>

              {isHotSeatOpen && (
                <div className="px-5 pb-6 pt-0 space-y-4 animate-in slide-in-from-top-4 duration-300 fade-in">
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-500/10 dark:to-transparent rounded-2xl border-l-4 border-amber-500">
                    <p className="text-sm text-amber-800 dark:text-amber-200 font-semibold leading-relaxed">
                      ⏳ No dodging! Face rapid-fire questions from friends in real-time.
                    </p>
                  </div>

                  <button
                    onClick={handleNavigateToHotSeat}
                    disabled={isNavigatingToHotSeat}
                    className="w-full py-4 bg-amber-600 text-white font-black rounded-2xl text-sm hover:bg-amber-700 transition-all active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isNavigatingToHotSeat ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />}
                    {isNavigatingToHotSeat ? 'Loading...' : 'Take the Seat'}
                  </button>
                </div>
              )}
            </div>
                {/* Rock Paper Scissors Card */}
            <div className="bg-white dark:bg-[#1a1429]/60 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
              <div
                onClick={() => setIsRpsOpen(!isRpsOpen)}
                className="p-5 flex items-center gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Swords size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-slate-900 dark:text-white text-lg">Rock Paper Scissors</h3>
                    <div className="relative flex items-center">
                      <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg shadow-emerald-500/30">New</span>
                    </div>
                  </div>
                  <p className="text-slate-500 dark:text-white/60 text-sm font-medium line-clamp-1">The classic battle</p>
                </div>
                <ChevronDown size={20} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isRpsOpen ? "rotate-180" : ""}`} />
              </div>

              {isRpsOpen && (
                <div className="px-5 pb-6 pt-0 space-y-4 animate-in slide-in-from-top-4 duration-300 fade-in">
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-500/10 dark:to-transparent rounded-2xl border-l-4 border-emerald-500">
                    <p className="text-sm text-emerald-800 dark:text-emerald-200 font-semibold leading-relaxed">
                      ⚔️ Settle the score! Jump into a best-of-5 showdown against the computer or a friend.
                    </p>
                  </div>

                  <button
                    onClick={handleNavigateToRps}
                    disabled={isNavigatingToRps}
                    className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl text-sm hover:bg-emerald-700 transition-all active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isNavigatingToRps ? <Loader2 size={18} className="animate-spin" /> : <Swords size={18} />}
                    {isNavigatingToRps ? 'Loading...' : 'Start Battle'}
                  </button>
                </div>
              )}
            </div>

          </div>
        </section>

      </main>
                  {/* DYKM Modal */}
      {isDykmModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1a1429] w-full max-w-lg rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto border border-white/20 dark:border-white/10 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-[#1a1429]/90 backdrop-blur-md z-10">
              <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">Create Quiz</h3>
              <button
                onClick={() => setIsDykmModalOpen(false)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/60 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/20 transition-all active:scale-90 hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {dykmQuestions.map((q, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-black flex items-center justify-center shadow-inner">
                      {idx + 1}
                    </span>
                    <span className="text-base font-bold text-slate-700 dark:text-white">Question {idx + 1}</span>
                  </div>

                  <div className="space-y-3">
                    <input
                      placeholder="e.g. What is my favorite color?"
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 focus:border-blue-500 dark:border-white/10 rounded-2xl px-5 py-4 text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:text-white transition-all placeholder:text-slate-400 dark:placeholder:text-white/30 font-medium"
                      value={q.question}
                      onChange={(e) => {
                        const newQ = [...dykmQuestions];
                        newQ[idx].question = e.target.value;
                        setDykmQuestions(newQ);
                      }}
                    />
                    <input
                      placeholder="Hint (optional but recommended)"
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 focus:border-blue-500 dark:border-white/10 rounded-2xl px-5 py-4 text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:text-white transition-all placeholder:text-slate-400 dark:placeholder:text-white/30 font-medium"
                      value={q.hint}
                      onChange={(e) => {
                        const newQ = [...dykmQuestions];
                        newQ[idx].hint = e.target.value;
                        setDykmQuestions(newQ);
                      }}
                    />
                    <input
                      placeholder="Correct Answer"
                      className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-100 focus:border-blue-500 dark:border-white/10 rounded-2xl px-5 py-4 text-sm text-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:text-white transition-all placeholder:text-slate-400 dark:placeholder:text-white/30"
                      value={q.answer}
                      onChange={(e) => {
                        const newQ = [...dykmQuestions];
                        newQ[idx].answer = e.target.value;
                        setDykmQuestions(newQ);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-[#1a1429]/90 sticky bottom-0 backdrop-blur-md pb-10">
              <button
                onClick={handleSaveDykm}
                disabled={isSavingDykm}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 hover:scale-[1.02] shadow-xl shadow-blue-500/20 text-base"
              >
                {isSavingDykm ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Save Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
                      }

            
