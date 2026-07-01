"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Lightbulb,
  Check,
  X,
  Trophy,
  ArrowRight,
  Sparkles,
  Rocket,
  Heart,
  Flame,
  Loader2,
  Lock,
  Crown,
} from "lucide-react"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import { createClient } from "@/lib/supabase/client"

type Question = {
  question: string
  hint: string
  answer: string
}

type AnswerRecord = {
  question: string
  correct_answer: string
  your_answer: string
  is_correct: boolean
  attempts_used: number
}

const MAX_ATTEMPTS = 2

function getTier(score: number, total: number) {
  const pct = total > 0 ? score / total : 0
  if (pct === 1) return { label: "Soulmate Status", emoji: "👑", color: "from-amber-400 to-yellow-500" }
  if (pct >= 0.7) return { label: "Basically Besties", emoji: "🔥", color: "from-orange-400 to-rose-500" }
  if (pct >= 0.4) return { label: "Getting There", emoji: "🌱", color: "from-emerald-400 to-teal-500" }
  return { label: "Total Stranger", emoji: "😅", color: "from-slate-400 to-slate-500" }
}

export default function DykmGameClient({ profile, questions }: { profile: any; questions: Question[] }) {
  const [stage, setStage] = useState<"intro" | "playing" | "summary">("intro")
  const [playerName, setPlayerName] = useState("")

  const [currentIndex, setCurrentIndex] = useState(0)
  const [input, setInput] = useState("")
  const [showHint, setShowHint] = useState(false)
  const [score, setScore] = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)
  const [feedback, setFeedback] = useState<"idle" | "correct" | "retry" | "reveal">("idle")
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [shake, setShake] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [scoreId, setScoreId] = useState<string | null>(null)
  const savingRef = useRef(false)

  const supabase = createClient()
  const router = useRouter()

  const currentQ = questions[currentIndex]

  const startQuiz = () => {
    if (!playerName.trim()) {
      toast.error("Don't be shy — tell us your name first! 👋")
      return
    }
    setStage("playing")
  }

  const goToNextQuestion = () => {
    setFeedback("idle")
    setInput("")
    setShowHint(false)
    setAttemptsLeft(MAX_ATTEMPTS)
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setStage("summary")
    }
  }

  const recordAnswer = (isCorrect: boolean, attemptsUsed: number, finalInput: string) => {
    setAnswers((prev) => [
      ...prev,
      {
        question: currentQ.question,
        correct_answer: currentQ.answer,
        your_answer: finalInput,
        is_correct: isCorrect,
        attempts_used: attemptsUsed,
      },
    ])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || feedback !== "idle") return

    const isCorrect = input.trim().toLowerCase() === currentQ.answer.trim().toLowerCase()

    if (isCorrect) {
      setFeedback("correct")
      setScore((s) => s + 1)
      confetti({ particleCount: 60, spread: 65, origin: { y: 0.7 } })
      recordAnswer(true, MAX_ATTEMPTS - attemptsLeft + 1, input.trim())
      setTimeout(goToNextQuestion, 1300)
      return
    }

    // Wrong answer
    if (attemptsLeft > 1) {
      // They still have another shot
      setAttemptsLeft((a) => a - 1)
      setFeedback("retry")
      setShake(true)
      toast.error("Not quite! One more shot 👀")
      setTimeout(() => {
        setFeedback("idle")
        setInput("")
        setShake(false)
      }, 900)
    } else {
      // Out of attempts
      setFeedback("reveal")
      recordAnswer(false, MAX_ATTEMPTS, input.trim())
      setTimeout(goToNextQuestion, 2200)
    }
  }

  // Auto-save the score the moment the quiz wraps up
  useEffect(() => {
    if (stage !== "summary" || savingRef.current) return
    savingRef.current = true

    const save = async () => {
      setIsSaving(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const { data, error } = await supabase
          .from("dykm_scores")
          .insert({
            quiz_owner_id: profile.id,
            responder_id: user?.id || null,
            responder_name: playerName.trim(),
            score: score,
            total_questions: questions.length,
            answers: answers,
          })
          .select("id")
          .single()

        if (error) throw error

        setScoreId(data.id)
        setIsSaved(true)

        if (score === questions.length) {
          confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 } })
        }
      } catch (err) {
        console.error(err)
        toast.error("Hmm, we couldn't save your score. Try again in a sec.")
      } finally {
        setIsSaving(false)
      }
    }

    save()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  const handleSeeResults = async () => {
    if (!scoreId) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const resultsPath = `/dykm/results/${scoreId}`
    if (user) {
      router.push(resultsPath)
    } else {
      router.push(`/signup?returnTo=${encodeURIComponent(resultsPath)}`)
    }
  }

  // ---------- STAGE: INTRO (collect name first) ----------
  if (stage === "intro") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-[#F8F9FD] to-[#F8F9FD] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white w-full max-w-md p-8 rounded-[2rem] shadow-xl shadow-indigo-100/50 border border-slate-100 text-center space-y-6"
        >
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-200 rotate-3">
            <Sparkles className="text-white" size={36} />
          </div>

          <div className="space-y-2">
            <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest rounded-full">
              Do You Know Me?
            </div>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">
              Think you really know {profile.username}? 👀
            </h1>
            <p className="text-slate-500 font-medium text-sm">
              {questions.length} questions. 2 tries each. Let's see if you're actually as close as you think.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <input
              autoFocus
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startQuiz()}
              placeholder="What's your name?"
              maxLength={40}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 text-center font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
            />
            <button
              onClick={startQuiz}
              disabled={!playerName.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              Let's Play <Rocket size={18} />
            </button>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            No pressure. Well... a little pressure. 😏
          </p>
        </motion.div>
      </div>
    )
  }

  // ---------- STAGE: SUMMARY ----------
  if (stage === "summary") {
    const tier = getTier(score, questions.length)

    return (
      <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white w-full max-w-md p-8 rounded-[2rem] shadow-xl border border-slate-100 text-center space-y-6"
        >
          <div
            className={`w-20 h-20 bg-gradient-to-tr ${tier.color} rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg text-4xl`}
          >
            {score === questions.length ? <Trophy size={40} className="text-white" /> : <span>{tier.emoji}</span>}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900">Nice one, {playerName.split(" ")[0]}!</h1>
            <div
              className={`inline-block px-4 py-1.5 bg-gradient-to-r ${tier.color} text-white text-xs font-black uppercase tracking-wider rounded-full`}
            >
              {tier.emoji} {tier.label}
            </div>
          </div>

          <p className="text-slate-500 font-medium">
            You scored{" "}
            <span className="text-indigo-600 font-black text-lg">
              {score}/{questions.length}
            </span>{" "}
            knowing {profile.username}.
          </p>

          <div className="flex justify-center gap-1.5 pt-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${
                  i < score ? "bg-emerald-500" : "bg-slate-200"
                }`}
              />
            ))}
          </div>

          <div className="pt-2">
            {!isSaved ? (
              <div className="flex items-center justify-center gap-2 text-slate-400 font-medium text-sm py-3">
                <Loader2 size={16} className="animate-spin" /> Locking in your score...
              </div>
            ) : (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleSeeResults}
                className="w-full py-4 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-200/50 flex items-center justify-center gap-2 group"
              >
                <Lock size={16} className="opacity-70" />
                Unlock the Answers
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </motion.button>
            )}
            <p className="text-xs text-slate-400 font-medium mt-2">
              See exactly what you got right (and wrong) 👇
            </p>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <p className="text-sm font-bold text-slate-600 mb-3">
              Think YOUR friends know you this well? 🤔
            </p>
            <a
              href="/login"
              className="block w-full py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition text-sm"
            >
              🎉 Create Your Own Quiz
            </a>
          </div>

          <a href="/" className="block text-sm text-slate-400 font-medium hover:text-slate-600 transition">
            Skip and go Home
          </a>
        </motion.div>
      </div>
    )
  }

  // ---------- STAGE: PLAYING ----------
  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center pt-12 px-4">
      <div className="w-full max-w-md space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest rounded-full">
            Do You Know Me?
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            How well do you know {profile.username}?
          </h1>
        </div>

        {/* Progress + Lives */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1.5 flex-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i < currentIndex
                    ? "bg-emerald-500"
                    : i === currentIndex
                    ? "bg-indigo-600"
                    : "bg-slate-200"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {[...Array(MAX_ATTEMPTS)].map((_, i) => (
              <Heart
                key={i}
                size={16}
                className={i < attemptsLeft ? "text-rose-500 fill-rose-500" : "text-slate-200 fill-slate-200"}
              />
            ))}
          </div>
        </div>

        {/* Question Card */}
        <motion.div
          animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden"
        >
          <AnimatePresence>
            {feedback === "correct" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-emerald-500/10 flex flex-col items-center justify-center z-10 backdrop-blur-[2px] gap-2"
              >
                <Check size={72} className="text-emerald-500 animate-in zoom-in duration-300" />
                <span className="font-black text-emerald-600">Nailed it! 🔥</span>
              </motion.div>
            )}
            {feedback === "retry" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-amber-500/10 flex flex-col items-center justify-center z-10 backdrop-blur-[2px] gap-2"
              >
                <X size={72} className="text-amber-500 animate-in zoom-in duration-300" />
                <span className="font-black text-amber-600">Not quite — try again!</span>
              </motion.div>
            )}
            {feedback === "reveal" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-rose-500/10 flex flex-col items-center justify-center z-10 backdrop-blur-[2px] gap-1 px-6 text-center"
              >
                <X size={64} className="text-rose-500 animate-in zoom-in duration-300" />
                <span className="font-black text-rose-600">Out of tries!</span>
                <span className="text-sm font-bold text-slate-700 mt-1">
                  Answer: <span className="text-rose-600">{currentQ.answer}</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <h2 className="text-xl font-medium text-slate-800 leading-relaxed">{currentQ.question}</h2>
            </div>

            {/* Hint Section */}
            <div>
              {!showHint ? (
                <button
                  onClick={() => setShowHint(true)}
                  className="text-xs font-bold text-indigo-600 flex items-center gap-1.5 hover:text-indigo-700 transition"
                >
                  <Lightbulb size={14} /> Psst... need a clue?
                </button>
              ) : (
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl animate-in fade-in slide-in-from-top-1">
                  <p className="text-xs text-indigo-700 font-medium">💡 Hint: {currentQ.hint}</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                autoFocus
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your answer..."
                disabled={feedback !== "idle"}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || feedback !== "idle"}
                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {attemptsLeft < MAX_ATTEMPTS ? (
                  <>
                    <Flame size={16} /> Last Shot!
                  </>
                ) : (
                  "Submit Answer"
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
