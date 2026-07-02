"use client"

import { useState, useEffect } from "react"
import { Space_Grotesk, Inter } from "next/font/google"
import {
  Copy, Check, MessageCircleQuestion, Loader2, Share2,
  LayoutGrid, Lock, ChevronDown, Brain, X, Save,
  Dices, Sparkles, Flame, Swords, BadgeCheck, Plus, Link2
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { createClient } from "@/lib/supabase/client"
import { useScrollLock } from "@/hooks/useScrollLock"
import XPBalance from "@/components/XPBalance"
import VerifiedBadge from "@/components/VerifiedBadge"
import Link from "next/link"

// Two-role type system: Space Grotesk carries personality for headings/wordmark,
// Inter stays quiet and legible for body copy. Ideally these live in app/layout.tsx
// so Next can inject the CSS vars globally — kept here so this file works standalone.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
})
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
})

interface DashboardClientProps {
  initialDykmQuestions?: any[]
  serverProfile?: any
}

export default function DashboardClient({ initialDykmQuestions, serverProfile }: DashboardClientProps) {
  const { user: authUser, profile: authProfile, loading: authLoading } = useAuth()
  const [supabase] = useState(() => createClient())

  // Use server data if available, otherwise fall back to auth context
  // This allows immediate rendering while hydration happens
  const profile = serverProfile || authProfile
  const loading = !profile && authLoading

  // Link States
  const [dykmCopied, setDykmCopied] = useState(false)
  const [amaCopied, setAmaCopied] = useState(false)
  const [confessCopied, setConfessCopied] = useState(false)
  const [hotSeatCopied, setHotSeatCopied] = useState(false)

  // Accordion States — expanded by default so every game explains itself
  // the moment the dashboard loads. Still collapsible via the chevron.
  const [isAmaOpen, setIsAmaOpen] = useState(true)
  const [isConfessOpen, setIsConfessOpen] = useState(true)
  const [isDykmOpen, setIsDykmOpen] = useState(true)
  const [isTodOpen, setIsTodOpen] = useState(true)
  const [isHotSeatOpen, setIsHotSeatOpen] = useState(true)
  const [isRpsOpen, setIsRpsOpen] = useState(true)
  const [isNavigatingToTod, setIsNavigatingToTod] = useState(false)
  const [isNavigatingToHotSeat, setIsNavigatingToHotSeat] = useState(false)
  const [isNavigatingToRps, setIsNavigatingToRps] = useState(false)
  const [isAnonymousOpen, setIsAnonymousOpen] = useState(true)
  const [anonymousCopied, setAnonymousCopied] = useState(false)


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
      // If not loading and no profile (neither server nor client), redirect
      // But Middleware should have caught this generally.
      router.push('/login')
    }
  }, [profile, loading, router])

  // Removed checkDykmStatus since we pass it from server
  // or we could keep it as a re-verification if needed, but for speed we rely on server prop

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
      //console.error(err)
    } finally {
      setIsSavingDykm(false)
    }
  }

  // Truth or Dare Logic - Navigate to TOD dashboard
  const handleNavigateToTod = () => {
    setIsNavigatingToTod(true)
    router.push('/tod')
  }

  // Hot Seat Logic - Navigate to Hot Seat
  const handleNavigateToHotSeat = () => {
    setIsNavigatingToHotSeat(true)
    router.push('/hot-seat')
  }

  // RPS Logic - Navigate to Rock Paper Scissors
  const handleNavigateToRps = () => {
    setIsNavigatingToRps(true)
    router.push('/rps')
  }

  // Stars top-up — assumption: routes to /store. Update if the real route differs.
  const handleAddStars = () => {
    router.push('/store')
  }

  if (loading || !profile) {
    return (
      <div className={`${display.variable} ${body.variable} min-h-screen flex items-center justify-center bg-gray-50 font-[family-name:var(--font-body)]`}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  const amaUrl = `https://say-app.vercel.app/ama/${profile.slug}`
  const confessUrl = `https://say-app.vercel.app/confess/${profile.slug}`
  const dykmUrl = `https://say-app.vercel.app/dykm/${profile.slug}`
  const anonymousUrl = `https://say-app.vercel.app/anonymous/${profile.slug}`
  const hotSeatUrl = `https://say-app.vercel.app/hot-seat/${profile.slug}`

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
    <div className={`${display.variable} ${body.variable} min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24 font-[family-name:var(--font-body)]`}>

      {/* Background Ambience (Dark Mode only) - Pinned from layout/settings style */}
      <div className="fixed inset-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Navbar — rebranded as linkslobby */}
      <nav className={`bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30 transition-all duration-200 ${isDykmModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-500 flex items-center justify-center shadow-md shadow-purple-500/20 rotate-0 hover:rotate-6 transition-transform duration-300">
              <Link2 size={16} className="text-white" strokeWidth={2.75} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none font-[family-name:var(--font-display)]">
              links<span className="text-purple-600 dark:text-purple-400">lobby</span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <XPBalance />
            <button
              onClick={handleAddStars}
              aria-label="Add stars"
              className="w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white flex items-center justify-center shadow-sm hover:scale-110 active:scale-90 transition-transform"
            >
              <Plus size={13} strokeWidth={3} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-8 relative z-10">

        <header className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-3 mb-1">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/30 shadow-md"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-lg ring-2 ring-purple-500/30 shadow-md font-[family-name:var(--font-display)]">
                {profile.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}

            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 leading-none font-[family-name:var(--font-display)]">
              Hi, {profile.username?.split(' ')[0]}
              {profile.is_pro
                ? <VerifiedBadge size={22} />
                : <Link href="/upgrade" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-600 transition">
                    <VerifiedBadge size={22} /> Get Verified
                  </Link>
              }
            </h1>
          </div>

          <p className="text-slate-500 dark:text-white/60 text-sm font-medium">
            Pick a game, share a link, see what happens.
          </p>
        </header>

        {/* Game Collection Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <LayoutGrid size={18} className="text-purple-600 dark:text-purple-400" />
            <h2 className="text-[10px] font-black text-slate-400 dark:text-white/40 uppercase tracking-[0.2em] font-[family-name:var(--font-display)]">Pick a Game</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">

            {/* Anonymous Link Card */}
            <div className="group bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div
                onClick={() => setIsAnonymousOpen(!isAnonymousOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                  <Share2 size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base font-[family-name:var(--font-display)]">Anonymous Link</h3>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Anonymous inbox, zero names 👀</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isAnonymousOpen ? "rotate-180" : ""}`} />
              </div>

              {isAnonymousOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">How to play</p>
                    {[
                      "Copy your link, drop it in your bio or story",
                      "Friends send you anything — no name attached",
                      "Read every message, guilt-free",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <p className="text-xs text-indigo-700/90 dark:text-indigo-300/90 leading-relaxed font-medium">{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 p-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                    <input
                      readOnly
                      value={anonymousUrl}
                      className="flex-1 bg-transparent pl-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-white/60 focus:outline-none truncate"
                    />
                    <button
                      onClick={() => handleCopy(anonymousUrl, 'anonymous')}
                      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 border ${anonymousCopied ? "bg-green-500 border-green-500 text-white" : "bg-white dark:bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5"}`}
                    >
                      {anonymousCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() => handleNativeShare(anonymousUrl, 'Send me an anonymous message!')}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 active:scale-90 bg-white dark:bg-transparent"
                    >
                      <Share2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Truth or Dare Card */}
            <div className="group bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
              <div
                onClick={() => setIsTodOpen(!isTodOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                  <Dices size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base font-[family-name:var(--font-display)]">Truth or Dare</h3>
                    <div className="relative">
                      {/* Beeping animation */}
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                      <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Live</span>
                    </div>
                  </div>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Dares with your crew, live</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isTodOpen ? "rotate-180" : ""}`} />
              </div>

              {isTodOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-100 dark:border-rose-500/20 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">How to play</p>
                    {[
                      "Create a lobby and invite your friends",
                      "Take turns picking truth or dare",
                      "Everyone plays in real time, no waiting",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-rose-100 dark:bg-rose-500/30 text-rose-700 dark:text-rose-300 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <p className="text-xs text-rose-700/90 dark:text-rose-300/90 leading-relaxed font-medium">{step}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleNavigateToTod}
                    disabled={isNavigatingToTod}
                    className="w-full py-3 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-all active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-rose-200 dark:shadow-rose-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isNavigatingToTod ? <Loader2 size={16} className="animate-spin" /> : <Dices size={16} />}
                    {isNavigatingToTod ? 'Loading...' : 'View Game Lobbies'}
                  </button>
                </div>
              )}
            </div>

            {/* DYKM Card */}
            <div className="group bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
              <div
                onClick={() => setIsDykmOpen(!isDykmOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                  <Brain size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base font-[family-name:var(--font-display)]">Do You Know Me?</h3>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Quiz your friends on all-things-you</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isDykmOpen ? "rotate-180" : ""}`} />
              </div>

              {isDykmOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">How to play</p>
                    {[
                      "Write 3 questions only your besties would know",
                      "Share your quiz link everywhere",
                      "Watch who really knows you",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-500/30 text-blue-700 dark:text-blue-300 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <p className="text-xs text-blue-700/90 dark:text-blue-300/90 leading-relaxed font-medium">{step}</p>
                      </div>
                    ))}
                  </div>

                  {!hasDykm ? (
                    <button
                      onClick={() => setIsDykmModalOpen(true)}
                      className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-all active:scale-95 hover:scale-[1.02] shadow-lg shadow-blue-200 dark:shadow-blue-900/20"
                    >
                      Create My Quiz
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                        <input
                          readOnly
                          value={dykmUrl}
                          className="flex-1 bg-transparent pl-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-white/60 focus:outline-none truncate"
                        />
                        <button
                          onClick={() => handleCopy(dykmUrl, 'dykm')}
                          className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 border ${dykmCopied ? "bg-green-500 border-green-500 text-white" : "bg-white dark:bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5"}`}
                        >
                          {dykmCopied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => handleNativeShare(dykmUrl, 'How well do you know me? Take the quiz!')}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 active:scale-90 bg-white dark:bg-transparent"
                        >
                          <Share2 size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => setIsDykmModalOpen(true)}
                        className="w-full py-2 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/60 font-bold rounded-xl text-[10px] hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95 hover:scale-[1.02]"
                      >
                        Edit Questions
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AMA Sticker Card */}
            <div className="group bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150">
              <div
                onClick={() => setIsAmaOpen(!isAmaOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                  <MessageCircleQuestion size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base font-[family-name:var(--font-display)]">Ask Me Anything</h3>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Ask anything. Names stay hidden.</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isAmaOpen ? "rotate-180" : ""}`} />
              </div>

              {isAmaOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-100 dark:border-orange-500/20 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">How to play</p>
                    {[
                      "Post your link to your story or bio",
                      "Friends ask you anything, anonymously",
                      "Answer as many as you like",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-500/30 text-orange-700 dark:text-orange-300 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <p className="text-xs text-orange-700/90 dark:text-orange-300/90 leading-relaxed font-medium">{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 p-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                    <input
                      readOnly
                      value={amaUrl}
                      className="flex-1 bg-transparent pl-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-white/60 focus:outline-none truncate"
                    />
                    <button
                      onClick={() => handleCopy(amaUrl, 'ama')}
                      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 border ${amaCopied ? "bg-green-500 border-green-500 text-white" : "bg-white dark:bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5"}`}
                    >
                      {amaCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() => handleNativeShare(amaUrl, 'Ask Me Anything anonymously!')}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 active:scale-90 bg-white dark:bg-transparent"
                    >
                      <Share2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Confessions Card */}
            <div className="group bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500 delay-200">
              <div
                onClick={() => setIsConfessOpen(!isConfessOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                  <Lock size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base font-[family-name:var(--font-display)]">Confessions</h3>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Secrets in, no ID required</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isConfessOpen ? "rotate-180" : ""}`} />
              </div>

              {isConfessOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-xl border border-purple-100 dark:border-purple-500/20 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">How to play</p>
                    {[
                      "Share your confession link",
                      "Anyone can confess, completely anonymous",
                      "You never see who sent it",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-500/30 text-purple-700 dark:text-purple-300 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <p className="text-xs text-purple-700/90 dark:text-purple-300/90 leading-relaxed font-medium">{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 p-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                    <input
                      readOnly
                      value={confessUrl}
                      className="flex-1 bg-transparent pl-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-white/60 focus:outline-none truncate"
                    />
                    <button
                      onClick={() => handleCopy(confessUrl, 'confess')}
                      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 border ${confessCopied ? "bg-green-500 border-green-500 text-white" : "bg-white dark:bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5"}`}
                    >
                      {confessCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() => handleNativeShare(confessUrl, 'Send me a secret confession!')}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 active:scale-90 bg-white dark:bg-transparent"
                    >
                      <Share2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hot Seat Card */}
            <div className="group bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500 delay-300">
              <div
                onClick={() => setIsHotSeatOpen(!isHotSeatOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                  <Flame size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base font-[family-name:var(--font-display)]">Hot Seat</h3>
                    <div className="relative">
                      {/* Beeping animation */}
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                      <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Live</span>
                    </div>
                  </div>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Fast questions. Faster answers.</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isHotSeatOpen ? "rotate-180" : ""}`} />
              </div>

              {isHotSeatOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-100 dark:border-amber-500/20 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">How to play</p>
                    {[
                      "Host a session and invite friends",
                      "Questions fire at you, rapid style",
                      "Answer live before time runs out",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-500/30 text-amber-700 dark:text-amber-300 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <p className="text-xs text-amber-700/90 dark:text-amber-300/90 leading-relaxed font-medium">{step}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleNavigateToHotSeat}
                    disabled={isNavigatingToHotSeat}
                    className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-700 transition-all active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-amber-200 dark:shadow-amber-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isNavigatingToHotSeat ? <Loader2 size={16} className="animate-spin" /> : <Flame size={16} />}
                    {isNavigatingToHotSeat ? 'Loading...' : 'Host Hot Seat'}
                  </button>
                </div>
              )}
            </div>

            {/* Rock Paper Scissors Card */}
            <div className="group bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500 delay-500">
              <div
                onClick={() => setIsRpsOpen(!isRpsOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                  <Swords size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base font-[family-name:var(--font-display)]">Rock Paper Scissors</h3>
                    <div className="relative">
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                      <span className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">New</span>
                    </div>
                  </div>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">First to 3 wins. Simple as that.</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isRpsOpen ? "rotate-180" : ""}`} />
              </div>

              {isRpsOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">How to play</p>
                    {[
                      "Pick Rock ✊, Paper ✋, or Scissors ✌️",
                      "First to win 3 rounds takes the match",
                      "Play the computer or challenge a friend",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <p className="text-xs text-emerald-700/90 dark:text-emerald-300/90 leading-relaxed font-medium">{step}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleNavigateToRps}
                    disabled={isNavigatingToRps}
                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-all active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isNavigatingToRps ? <Loader2 size={16} className="animate-spin" /> : <Swords size={16} />}
                    {isNavigatingToRps ? 'Loading...' : 'Play Now'}
                  </button>
                </div>
              )}
            </div>

          </div>
        </section>

      </main>

      {/* DYKM Modal */}
      {isDykmModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1a1429] w-full max-w-lg rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto border border-white/20 dark:border-white/10 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-[#1a1429]/90 backdrop-blur-md z-10">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white font-[family-name:var(--font-display)]">Create Quiz</h3>
              <button
                onClick={() => setIsDykmModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/60 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/20 transition-all active:scale-90 hover:rotate-90"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {dykmQuestions.map((q, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-700 dark:text-white">Question {idx + 1}</span>
                  </div>

                  <div className="space-y-2">
                    <input
                      placeholder="e.g. What is my favorite color?"
                      className="w-full bg-white dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all placeholder:text-slate-400 dark:placeholder:text-white/30"
                      value={q.question}
                      onChange={(e) => {
                        const newQ = [...dykmQuestions];
                        newQ[idx].question = e.target.value;
                        setDykmQuestions(newQ);
                      }}
                    />
                    <input
                      placeholder="Hint (optional but recommended)"
                      className="w-full bg-white dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all placeholder:text-slate-400 dark:placeholder:text-white/30"
                      value={q.hint}
                      onChange={(e) => {
                        const newQ = [...dykmQuestions];
                        newQ[idx].hint = e.target.value;
                        setDykmQuestions(newQ);
                      }}
                    />
                    <input
                      placeholder="Correct Answer"
                      className="w-full bg-white dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all placeholder:text-slate-400 dark:placeholder:text-white/30"
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
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 transition active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-blue-500/20"
              >
                {isSavingDykm ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Save Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
