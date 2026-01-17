"use client"

import { useState, useEffect } from "react"
import { 
  Copy, Check, MessageCircleQuestion, Loader2, Share2, 
  LayoutGrid, Lock, ChevronDown, Brain, X, Save,
  Dices, Sparkles 
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation" 
import { useAuth } from "@/context/AuthContext"
import { createClient } from "@/lib/supabase/client"
import XPBalance from "@/components/XPBalance"

export default function DashboardClient() {
  const { user, profile, loading } = useAuth()
  const [supabase] = useState(() => createClient())
  
  // Link States
  const [heroCopied, setHeroCopied] = useState(false)
  const [dykmCopied, setDykmCopied] = useState(false)
  const [amaCopied, setAmaCopied] = useState(false)
  const [confessCopied, setConfessCopied] = useState(false)
  
  // Accordion States
  const [isAmaOpen, setIsAmaOpen] = useState(false)
  const [isConfessOpen, setIsConfessOpen] = useState(false)
  const [isDykmOpen, setIsDykmOpen] = useState(false)
  const [isTodOpen, setIsTodOpen] = useState(false)

  // DYKM Logic
  const [hasDykm, setHasDykm] = useState(false)
  const [isDykmModalOpen, setIsDykmModalOpen] = useState(false)
  const [isSavingDykm, setIsSavingDykm] = useState(false)
  const [dykmQuestions, setDykmQuestions] = useState([
    { question: "", hint: "", answer: "" },
    { question: "", hint: "", answer: "" },
    { question: "", hint: "", answer: "" },
  ])
  
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
      } else if (!profile) {
        router.push('/auth/setup')
      } else {
        checkDykmStatus()
      }
    }
  }, [user, profile, loading, router])

  const checkDykmStatus = async () => {
    if (!profile) return
    const { data } = await supabase
      .from('dykm_quizzes')
      .select('user_id, questions')
      .eq('user_id', profile.id)
      .maybeSingle()
    
    if (data) {
      setHasDykm(true)
      setDykmQuestions(data.questions)
    }
  }

  const handleSaveDykm = async () => {
    if (dykmQuestions.some(q => !q.question || !q.answer)) {
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
    router.push('/tod')
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

  const handleCopy = async (text: string, type: 'hero' | 'ama' | 'confess' | 'dykm') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'hero') { setHeroCopied(true); setTimeout(() => setHeroCopied(false), 2000) }
      else if (type === 'ama') { setAmaCopied(true); setTimeout(() => setAmaCopied(false), 2000) }
      else if (type === 'confess') { setConfessCopied(true); setTimeout(() => setConfessCopied(false), 2000) }
      else if (type === 'dykm') { setDykmCopied(true); setTimeout(() => setDykmCopied(false), 2000) }
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
        <section className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100">
          {/* Profile Section - Top Right */}
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-full border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                {profile.username?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-slate-700">
                @{profile.username}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="text-center">
            <p className="text-slate-500 text-sm mb-6">
              Share your link to start receiving messages.
            </p>

            <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl max-w-sm mx-auto">
              <div className="pl-3 text-slate-400 shrink-0">
                <Share2 size={16} />
              </div>
              <input 
                readOnly 
                value={anonymousUrl}
                className="flex-1 bg-transparent py-2 text-xs font-semibold text-slate-600 focus:outline-none truncate"
              />
              <button
                onClick={() => handleCopy(anonymousUrl, 'hero')}
                className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 ${heroCopied ? "bg-green-500 text-white" : "bg-purple-600 text-white hover:bg-purple-700"}`}
              >
                {heroCopied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>
        </section>

        {/* Game Collection Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <LayoutGrid size={18} className="text-purple-600" />
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Game Collection</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            
            {/* Truth or Dare Card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm transition-all overflow-hidden">
              <div 
                onClick={() => setIsTodOpen(!isTodOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Dices size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">Truth or Dare</h3>
                    <div className="relative">
                      {/* Beeping animation */}
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                      <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Live</span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs line-clamp-1">Play with friends in real-time</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 transition-transform duration-300 ${isTodOpen ? "rotate-180" : ""}`} />
              </div>

              {isTodOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <p className="text-[11px] text-rose-700 leading-relaxed font-medium">
                      How it works: Create a lobby and share the link. Everyone takes turns asking or being the target. Real-time multiplayer fun!
                    </p>
                  </div>
                  
                  <button 
                    onClick={handleNavigateToTod}
                    className="w-full py-3 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition flex items-center justify-center gap-2"
                  >
                    <Sparkles size={16} />
                    View Game Lobbies
                  </button>
                </div>
              )}
            </div>

            {/* DYKM Card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm transition-all overflow-hidden">
               <div 
                 onClick={() => setIsDykmOpen(!isDykmOpen)}
                 className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 transition-colors"
               >
                 <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                   <Brain size={24} />
                 </div>
                 <div className="flex-1 min-w-0">
                   <h3 className="font-bold text-slate-900 text-base">Do You Know Me?</h3>
                   <p className="text-slate-400 text-xs line-clamp-1">Create a quiz to test your friends</p>
                 </div>
                 <ChevronDown size={18} className={`text-slate-300 transition-transform duration-300 ${isDykmOpen ? "rotate-180" : ""}`} />
               </div>

               {isDykmOpen && (
                 <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                   <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                     <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                       How it works: Create 3 personal questions. Friends answer them to see how well they really know you.
                     </p>
                   </div>
                   
                   {!hasDykm ? (
                     <button 
                       onClick={() => setIsDykmModalOpen(true)}
                       className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition"
                     >
                       Create My Quiz
                     </button>
                   ) : (
                     <div className="space-y-3">
                        <div className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-200 rounded-xl">
                         <input 
                           readOnly 
                           value={dykmUrl}
                           className="flex-1 bg-transparent pl-3 py-1.5 text-[10px] font-bold text-slate-500 focus:outline-none truncate"
                         />
                         <button
                           onClick={() => handleCopy(dykmUrl, 'dykm')}
                           className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 border ${dykmCopied ? "bg-green-500 border-green-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                         >
                           {dykmCopied ? <Check size={14} /> : <Copy size={14} />}
                         </button>
                       </div>
                       <button 
                         onClick={() => setIsDykmModalOpen(true)}
                         className="w-full py-2 border border-slate-200 text-slate-500 font-bold rounded-xl text-[10px] hover:bg-slate-50 transition"
                       >
                         Edit Questions
                       </button>
                     </div>
                   )}
                 </div>
               )}
            </div>

            {/* AMA Sticker Card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm transition-all overflow-hidden">
              <div 
                onClick={() => setIsAmaOpen(!isAmaOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <MessageCircleQuestion size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-base">AMA Sticker</h3>
                  <p className="text-slate-400 text-xs line-clamp-1">Get a question sticker for your Instagram story</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 transition-transform duration-300 ${isAmaOpen ? "rotate-180" : ""}`} />
              </div>

              {isAmaOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <p className="text-[11px] text-orange-700 leading-relaxed font-medium">
                      How it works: Share this link on your Instagram story. Friends can tap it to ask you anything anonymously.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-200 rounded-xl">
                    <input 
                      readOnly 
                      value={amaUrl}
                      className="flex-1 bg-transparent pl-3 py-1.5 text-[10px] font-bold text-slate-500 focus:outline-none truncate"
                    />
                    <button
                      onClick={() => handleCopy(amaUrl, 'ama')}
                      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 border ${amaCopied ? "bg-green-500 border-green-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                    >
                      {amaCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Confessions Card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm transition-all overflow-hidden">
              <div 
                onClick={() => setIsConfessOpen(!isConfessOpen)}
                className="p-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Lock size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-base">Confessions</h3>
                  <p className="text-slate-400 text-xs line-clamp-1">Receive anonymous secrets and messages</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 transition-transform duration-300 ${isConfessOpen ? "rotate-180" : ""}`} />
              </div>

              {isConfessOpen && (
                <div className="px-4 pb-5 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <p className="text-[11px] text-purple-700 leading-relaxed font-medium">
                      How it works: Share this special link. Anyone can send you a secret message without you knowing who they are.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-200 rounded-xl">
                    <input 
                      readOnly 
                      value={confessUrl}
                      className="flex-1 bg-transparent pl-3 py-1.5 text-[10px] font-bold text-slate-500 focus:outline-none truncate"
                    />
                    <button
                      onClick={() => handleCopy(confessUrl, 'confess')}
                      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 border ${confessCopied ? "bg-green-500 border-green-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                    >
                      {confessCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
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

      {/* DYKM Modal */}
      {isDykmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
              <h3 className="font-bold text-lg text-slate-900">Create Quiz</h3>
              <button 
                onClick={() => setIsDykmModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              {dykmQuestions.map((q, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-700">Question {idx + 1}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <input 
                      placeholder="e.g. What is my favorite color?"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={q.question}
                      onChange={(e) => {
                        const newQ = [...dykmQuestions];
                        newQ[idx].question = e.target.value;
                        setDykmQuestions(newQ);
                      }}
                    />
                     <input 
                      placeholder="Hint (optional but recommended)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={q.hint}
                      onChange={(e) => {
                        const newQ = [...dykmQuestions];
                        newQ[idx].hint = e.target.value;
                        setDykmQuestions(newQ);
                      }}
                    />
                           <input 
                      placeholder="Correct Answer"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 sticky bottom-0 backdrop-blur-md">
              <button
                onClick={handleSaveDykm}
                disabled={isSavingDykm}
                className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 disabled:active:scale-100"
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
