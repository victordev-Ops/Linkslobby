"use client"

import { useState, useEffect } from "react"
import {
  Copy, Check, MessageCircleQuestion, Loader2, Share2,
  LayoutGrid, Lock, ChevronDown, Brain, X, Save,
  Dices, Sparkles, Flame
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { createClient } from "@/lib/supabase/client"
import { useScrollLock } from "@/hooks/useScrollLock"
import XPBalance from "@/components/XPBalance"

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
  const [heroCopied, setHeroCopied] = useState(false)
  const [dykmCopied, setDykmCopied] = useState(false)
  const [amaCopied, setAmaCopied] = useState(false)
  const [confessCopied, setConfessCopied] = useState(false)
  const [hotSeatCopied, setHotSeatCopied] = useState(false)

  // Accordion States
  const [isAmaOpen, setIsAmaOpen] = useState(false)
  const [isConfessOpen, setIsConfessOpen] = useState(false)
  const [isDykmOpen, setIsDykmOpen] = useState(false)
  const [isTodOpen, setIsTodOpen] = useState(false)
  const [isHotSeatOpen, setIsHotSeatOpen] = useState(false)
  const [isNavigatingToTod, setIsNavigatingToTod] = useState(false)
  const [isNavigatingToHotSeat, setIsNavigatingToHotSeat] = useState(false)


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
      console.error(err)
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

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  const amaUrl = `https://say-app.vercel.app/ama/${profile.slug}`
  const confessUrl = `https://say-app.vercel.app/confess/${profile.slug}`
  const dykmUrl = `https://say-app.vercel.app/dykm/${profile.slug}`
  const anonymousUrl = `https://say-app.vercel.app/anonymous/${profile.slug}`
  const hotSeatUrl = `https://say-app.vercel.app/hot-seat/${profile.slug}`

  const handleCopy = async (text: string, type: 'hero' | 'ama' | 'confess' | 'dykm' | 'hotSeat') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'hero') { setHeroCopied(true); setTimeout(() => setHeroCopied(false), 2000) }
      else if (type === 'ama') { setAmaCopied(true); setTimeout(() => setAmaCopied(false), 2000) }
      else if (type === 'confess') { setConfessCopied(true); setTimeout(() => setConfessCopied(false), 2000) }
      else if (type === 'dykm') { setDykmCopied(true); setTimeout(() => setDykmCopied(false), 2000) }
      else if (type === 'hotSeat') { setHotSeatCopied(true); setTimeout(() => setHotSeatCopied(false), 2000) }
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
    <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24">

      {/* Background Ambience (Dark Mode only) - Pinned from layout/settings style */}
      <div className="fixed inset-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className={`bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30 transition-all duration-200 ${isDykmModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-lg italic">S</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Say</h2>
          </div>
          <XPBalance />
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-8 relative z-10">

        {/* Hero Section */}
        <section className="relative overflow-hidden bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-xl rounded-[2.5rem] p-6 md:p-8 shadow-xl border border-slate-100 dark:border-white/10 transition-all group">
          {/* Decorative Gradients */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-colors" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -ml-16 -mb-16 group-hover:bg-indigo-500/20 transition-colors" />

          {/* Profile Section - Centered for Modern Look */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="relative group/avatar">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-600 rounded-full blur-md opacity-20 group-hover/avatar:opacity-40 transition-opacity" />
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-20 h-20 rounded-full border-4 border-white dark:border-[#1a1429] object-cover relative z-10"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 border-4 border-white dark:border-[#1a1429] flex items-center justify-center text-white font-black text-2xl relative z-10 shadow-lg">
                  {profile.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-white dark:border-[#1a1429] z-20" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Welcome back
              </h1>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                @{profile.username}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white/90">Your Anonymous link</h2>
              <p className="text-slate-500 dark:text-white/60 text-xs max-w-[280px] mx-auto leading-relaxed">
                Send this link to friends to receive anonymous messages
              </p>
            </div>

            <div className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl max-w-sm mx-auto transition-all group-hover:border-purple-500/30">
              <div className="pl-3 text-slate-400 dark:text-white/40 shrink-0">
                <Share2 size={16} />
              </div>
              <input
                readOnly
                value={anonymousUrl}
                className="flex-1 bg-transparent py-2 text-xs font-semibold text-slate-600 dark:text-white focus:outline-none truncate"
              />
              <button
                onClick={() => handleCopy(anonymousUrl, 'hero')}
                className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 shadow-md ${heroCopied ? "bg-green-500 text-white" : "bg-slate-900 dark:bg-purple-600 text-white hover:bg-slate-800 dark:hover:bg-purple-700"}`}
              >
                {heroCopied ? <Check size={18} /> : <Copy size={18} />}
              </button>
              <button
                onClick={() => handleNativeShare(anonymousUrl, 'Send me an anonymous message!')}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-md bg-white dark:bg-transparent border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 active:scale-90"
              >
                <Share2 size={18} />
              </button>
            </div>
            {/* Added Hero Iframe Preview */}
            <IframePreview url={anonymousUrl} />
          </div>
        </section>

        {/* Game Collection Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <LayoutGrid size={18} className="text-purple-600 dark:text-purple-400" />
            <h2 className="text-[10px] font-black text-slate-400 dark:text-white/40 uppercase tracking-[0.2em]">Game Collection</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">

            {/* Truth or Dare Card */}
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm transition-all overflow-hidden">
              <div
                onClick={() => setIsTodOpen(!isTodOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Dices size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Truth or Dare</h3>
                    <div className="relative">
                      {/* Beeping animation */}
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                      <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Live</span>
                    </div>
                  </div>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Play Truth/Dare Challenge with friends </p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isTodOpen ? "rotate-180" : ""}`} />
              </div>

              {isTodOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-100 dark:border-rose-500/20">
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                      How it works: Create a lobby and share the link with friends. Everyone takes turns asking or being the target. Real-time multiplayer fun!
                    </p>
                  </div>

                  <button
                    onClick={handleNavigateToTod}
                    disabled={isNavigatingToTod}
                    className="w-full py-3 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-all active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-rose-200 dark:shadow-rose-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isNavigatingToTod ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {isNavigatingToTod ? 'Loading...' : 'View Game Lobbies'}
                  </button>
                </div>
              )}
            </div>

            {/* DYKM Card */}
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm transition-all overflow-hidden">
              <div
                onClick={() => setIsDykmOpen(!isDykmOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Brain size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Do You Know Me?</h3>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Create a quiz to test your friends</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isDykmOpen ? "rotate-180" : ""}`} />
              </div>

              {isDykmOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                      How it works: Create 3 personal questions. Friends answer them to see how well they really know you.
                    </p>
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
                      <IframePreview url={dykmUrl} />
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
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm transition-all overflow-hidden">
              <div
                onClick={() => setIsAmaOpen(!isAmaOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <MessageCircleQuestion size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Ask Me Anything </h3>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Get AMA link for your story and bio</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isAmaOpen ? "rotate-180" : ""}`} />
              </div>

              {isAmaOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-100 dark:border-orange-500/20">
                    <p className="text-[11px] text-orange-700 dark:text-orange-300 leading-relaxed font-medium">
                      How it works: Share this link on your Story and Bio. Friends can tap it to ask you anything anonymously.
                    </p>
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
                  <IframePreview url={amaUrl} />
                </div>
              )}
            </div>

            {/* Confessions Card */}
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm transition-all overflow-hidden">
              <div
                onClick={() => setIsConfessOpen(!isConfessOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Lock size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Confessions</h3>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Receive anonymous confession and messages</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isConfessOpen ? "rotate-180" : ""}`} />
              </div>

              {isConfessOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-xl border border-purple-100 dark:border-purple-500/20">
                    <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed font-medium">
                      How it works: Share this special link. Anyone can send you a secret confession without you knowing who they are.
                    </p>
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
                  <IframePreview url={confessUrl} />
                </div>
              )}
            </div>

            {/* Hot Seat Card */}
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm transition-all overflow-hidden">
              <div
                onClick={() => setIsHotSeatOpen(!isHotSeatOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Flame size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Hot Seat</h3>
                    <div className="relative">
                      {/* Beeping animation */}
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                      <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Live</span>
                    </div>
                  </div>
                  <p className="text-slate-400 dark:text-white/60 text-xs line-clamp-1">Answer rapid-fire questions under pressure</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-white/30 transition-transform duration-300 ${isHotSeatOpen ? "rotate-180" : ""}`} />
              </div>

              {isHotSeatOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-100 dark:border-amber-500/20">
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
                      How it works: Host a hot seat session and answer burning questions from your friends. Fast-paced and revealing!
                    </p>
                  </div>

                  <button
                    onClick={handleNavigateToHotSeat}
                    disabled={isNavigatingToHotSeat}
                    className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-700 transition-all active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-amber-200 dark:shadow-amber-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isNavigatingToHotSeat ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {isNavigatingToHotSeat ? 'Loading...' : 'Host Hot Seat'}
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
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Create Quiz</h3>
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

function IframePreview({ url }: { url: string }) {
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 h-64 pointer-events-none relative bg-slate-50 dark:bg-[#1a1429]/40 z-0">
      <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 to-transparent dark:from-[#1a1429]/90 dark:via-[#1a1429]/20 z-10" />
      <iframe src={url} className="w-[125%] h-[125%] transform scale-[0.8] origin-top-left border-none" tabIndex={-1} aria-hidden="true" sandbox="allow-same-origin allow-scripts" />
    </div>
  )
}
