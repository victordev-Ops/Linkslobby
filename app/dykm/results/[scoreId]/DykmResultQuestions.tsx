"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, X, Lock, Eye, Loader2 } from "lucide-react"
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
            // Pro users don't pay, just show (conceptually revealed)
            // But we might still want to track it or just show it via UI state if we trust isPro check
            // For now, let's treat Pro as "always visible" in render, so this might not be reachable
            return
        }

        setIsRevealing(index)
        try {
            const result = await revealDYKMAnswer(scoreId, index)
            if (result.success) {
                setRevealed(prev => new Set(prev).add(index))
                toast.success("Answer revealed!")
                router.refresh()
            } else {
                toast.error(result.message || "Failed to reveal")
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
                // logic:
                // - if user is NOT owner (responder viewing their own result): show everything? 
                //   User said "show user who answered questions and thier answers... cost the user 5 star".
                //   This implies the OWNER pays to see the RESPONDER'S answers.
                //   If I am the RESPONDER viewing my own result, I should see what I typed.
                //   So !isOwner => isRevealed = true.

                // - if is_correct: We show it (no cost).
                // - if isPro: Show it.
                // - if revealed: Show it.

                return (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white dark:bg-[#1a1429] p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm relative overflow-hidden"
                    >
                        {/* Status Icon */}
                        <div className="absolute top-4 right-4 text-slate-200 dark:text-slate-700">
                            {ans.is_correct ? <Check size={24} className="text-green-500/20" /> : <X size={24} className="text-red-500/20" />}
                        </div>

                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Question {i + 1}
                        </p>
                        <h3 className="text-base font-medium text-slate-900 dark:text-white mb-4">
                            {ans.question}
                        </h3>

                        <div className="space-y-3">
                            {/* Correct Answer (Always visible to owner? Or only if they answered right?)
                                Usually "The correct answer was X" is shown.
                                I'll show the correct answer always for context.
                            */}
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                    Correct Answer
                                </span>
                                <div className="text-sm font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                                    <Check size={14} />
                                    {ans.correct_answer}
                                </div>
                            </div>

                            {/* Their Answer */}
                            <div className={`p-3 rounded-xl border transition-colors ${ans.is_correct
                                    ? "bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20"
                                    : "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20"
                                }`}>
                                <span className={`text-[10px] font-bold uppercase block mb-1 ${ans.is_correct ? "text-green-600/70 dark:text-green-400/70" : "text-red-600/70 dark:text-red-400/70"
                                    }`}>
                                    They Answered
                                </span>

                                {isRevealed ? (
                                    <div className={`text-sm font-bold flex items-center gap-2 ${ans.is_correct ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                                        }`}>
                                        {ans.is_correct ? <Check size={14} /> : <X size={14} />}
                                        {ans.your_answer}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium text-slate-400 italic">
                                            Hidden Answer
                                        </div>
                                        <button
                                            onClick={() => handleReveal(i)}
                                            disabled={isRevealing === i}
                                            className="px-3 py-1.5 bg-white dark:bg-white/10 text-slate-900 dark:text-white text-xs font-bold rounded-lg shadow-sm border border-slate-200 dark:border-white/10 flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-white/20 transition disabled:opacity-50"
                                        >
                                            {isRevealing === i ? (
                                                <Loader2 size={12} className="animate-spin" />
                                            ) : (
                                                <><Eye size={12} /> Reveal (5 ★)</>
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
