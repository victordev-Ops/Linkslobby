"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Check, X, Eye, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { revealDYKMAnswer } from "@/actions/reveal"
import { useRouter } from "next/navigation"

type Answer = {
    question: string
    correct_answer: string
    your_answer: string
    is_correct: boolean
}

interface DykmResultQuestionsProps {
    scoreId: string
    answers: Answer[] | null // answers might be null if not populated yet
    revealedIndices: number[]
    isPro: boolean
    isOwner: boolean
}

export default function DykmResultQuestions({ scoreId, answers, revealedIndices, isPro, isOwner }: DykmResultQuestionsProps) {
    const [revealed, setRevealed] = useState<Set<number>>(new Set(revealedIndices))
    const [isRevealing, setIsRevealing] = useState<number | null>(null)
    const router = useRouter()

    if (!answers || !answers.length) {
        return (
            <div className="text-center text-slate-400 py-8">
                <p>No detailed answers available for this score.</p>
            </div>
        )
    }

    const handleReveal = async (index: number) => {
        if (isPro) {
            return
        }

        setIsRevealing(index)
        try {
            const result = await revealDYKMAnswer(scoreId, index)
            if (result.success) {
                setRevealed(prev => new Set(prev).add(index))
                toast.success("Answer unlocked! 🔓")
                router.refresh()
            } else {
                toast.error(result.message || "Couldn't unlock that one — try again")
            }
        } catch (error) {
            toast.error("Something went wrong")
        } finally {
            setIsRevealing(null)
        }
    }

    return (
        <div className="space-y-4">
            {answers.map((ans, i) => {
                const isRevealed = isPro || revealed.has(i) || ans.is_correct || !isOwner

                return (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="bg-white dark:bg-[#1a1429] p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm relative overflow-hidden"
                    >
                        {/* Status Icon */}
                        <div className="absolute top-4 right-4">
                            {ans.is_correct ? (
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full flex items-center gap-1">
                                    <Check size={12} /> Nailed it
                                </span>
                            ) : (
                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-full flex items-center gap-1">
                                    <X size={12} /> Missed it
                                </span>
                            )}
                        </div>

                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Question {i + 1}
                        </p>
                        <h3 className="text-base font-medium text-slate-900 dark:text-white mb-4 pr-24">
                            {ans.question}
                        </h3>

                        <div className="space-y-3">
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                    Correct Answer
                                </span>
                                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                    <Check size={14} />
                                    {ans.correct_answer}
                                </div>
                            </div>

                            {/* Their Answer */}
                            <div className={`p-3 rounded-xl border transition-colors ${ans.is_correct
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20"
                                    : "bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20"
                                }`}>
                                <span className={`text-[10px] font-bold uppercase block mb-1 ${ans.is_correct ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-rose-600/70 dark:text-rose-400/70"
                                    }`}>
                                    They Guessed
                                </span>

                                {isRevealed ? (
                                    <div className={`text-sm font-bold flex items-center gap-2 ${ans.is_correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                                        }`}>
                                        {ans.is_correct ? <Check size={14} /> : <X size={14} />}
                                        {ans.your_answer}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium text-slate-400 italic">
                                            🔒 Still a secret
                                        </div>
                                        <button
                                            onClick={() => handleReveal(i)}
                                            disabled={isRevealing === i}
                                            className="px-3 py-1.5 bg-white dark:bg-white/10 text-slate-900 dark:text-white text-xs font-bold rounded-lg shadow-sm border border-slate-200 dark:border-white/10 flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-white/20 transition disabled:opacity-50"
                                        >
                                            {isRevealing === i ? (
                                                <Loader2 size={12} className="animate-spin" />
                                            ) : (
                                                <><Sparkles size={12} /> Unlock (5 ★)</>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
                    }
                              
