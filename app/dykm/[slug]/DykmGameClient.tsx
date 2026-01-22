"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Lightbulb, Check, X, Trophy } from "lucide-react"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import { createClient } from "@/lib/supabase/client"

type Question = {
  question: string
  hint: string
  answer: string
}

export default function DykmGameClient({ profile, questions }: { profile: any, questions: Question[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [input, setInput] = useState("")
  const [showHint, setShowHint] = useState(false)
  const [score, setScore] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [responderName, setResponderName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const currentQ = questions[currentIndex]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const isCorrect = input.trim().toLowerCase() === currentQ.answer.trim().toLowerCase()

    if (isCorrect) {
      setFeedback('correct')
      setScore(s => s + 1)
      toast.success("Correct!")
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } })
    } else {
      setFeedback('wrong')
      toast.error(`Wrong! It was: ${currentQ.answer}`)
    }

    setTimeout(async () => {
      setFeedback('idle')
      setInput("")
      setShowHint(false)
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1)
      } else {
        setIsFinished(true)
        if (isCorrect) confetti()
      }
    }, 1500)
  }

  const handleFinish = async () => {
    if (!responderName.trim()) {
      toast.error("Please enter your name")
      return
    }

    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('dykm_scores')
        .insert({
          quiz_owner_id: profile.id,
          responder_id: user?.id || null,
          responder_name: responderName.trim(),
          score: score,
          total_questions: questions.length
        })

      if (error) throw error

      toast.success("Score saved!")
      router.push("/")
    } catch (err) {
      console.error(err)
      toast.error("Failed to save score")
    } finally {
      setIsSaving(false)
    }
  }

  if (isFinished) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-[2rem] shadow-sm border border-slate-100 text-center space-y-6">
          <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy size={40} />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Quiz Complete!</h1>
          <p className="text-slate-500">
            You scored <span className="text-blue-600 font-bold text-lg">{score}</span> out of {questions.length} knowing {profile.username}.
          </p>

          <div className="space-y-4 pt-4">
            <input
              type="text"
              value={responderName}
              onChange={(e) => setResponderName(e.target.value)}
              placeholder="Enter your name to save score"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
            <button
              onClick={handleFinish}
              disabled={isSaving || !responderName.trim()}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Score & Continue"}
            </button>
          </div>

          <a href="/" className="block text-sm text-slate-400 font-medium hover:text-slate-600 transition">
            Skip and go Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center pt-12 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest rounded-full">
            Do You Know Me?
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            How well do you know {profile.username}?
          </h1>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentIndex ? 'bg-blue-600' : 'bg-slate-200'}`} />
          ))}
        </div>

        {/* Question Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
          {feedback === 'correct' && (
            <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center z-10 backdrop-blur-[1px]">
              <Check size={80} className="text-green-500 animate-in zoom-in duration-300" />
            </div>
          )}
          {feedback === 'wrong' && (
            <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center z-10 backdrop-blur-[1px]">
              <X size={80} className="text-red-500 animate-in zoom-in duration-300" />
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Question {currentIndex + 1}</span>
              <h2 className="text-xl font-medium text-slate-800 leading-relaxed">
                {currentQ.question}
              </h2>
            </div>

            {/* Hint Section */}
            <div>
              {!showHint ? (
                <button
                  onClick={() => setShowHint(true)}
                  className="text-xs font-bold text-blue-600 flex items-center gap-1.5 hover:text-blue-700 transition"
                >
                  <Lightbulb size={14} /> Need a hint?
                </button>
              ) : (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl animate-in fade-in slide-in-from-top-1">
                  <p className="text-xs text-blue-700 font-medium">💡 Hint: {currentQ.hint}</p>
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              />
              <button
                type="submit"
                disabled={!input.trim() || feedback !== 'idle'}
                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
              >
                Submit Answer
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

