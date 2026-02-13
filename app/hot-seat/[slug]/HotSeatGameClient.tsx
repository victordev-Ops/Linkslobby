"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ArrowLeft, Flame, Send, Loader2, Clock, Play, AlertCircle, MessageCircle, X } from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { penalizeHotSeatTimeout } from "@/actions/hot-seat-xp"

interface HotSeatGameClientProps {
    session: any
    userProfile: any
}

interface Question {
    id: string
    question: string
    answer: string | null
    status: 'pending' | 'active' | 'answered' | 'skipped' | 'timed_out'
    asker_id: string
    created_at: string
}

export default function HotSeatGameClient({ session, userProfile }: HotSeatGameClientProps) {
    const supabase = useMemo(() => createClient(), [])
    const router = useRouter()

    // Game State
    const [status, setStatus] = useState<'waiting' | 'active' | 'finished'>(session.status)
    const [isHost, setIsHost] = useState(userProfile.id === session.host_id)
    const [questions, setQuestions] = useState<Question[]>([])
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)

    // Participant State
    const [participantCount, setParticipantCount] = useState(0)
    const [newQuestion, setNewQuestion] = useState("")
    const [isSending, setIsSending] = useState(false)

    // Host State
    const [answer, setAnswer] = useState("")
    const [timer, setTimer] = useState(30)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const [isAnswering, setIsAnswering] = useState(false)

    // Initial Data Fetch
    useEffect(() => {
        const fetchState = async () => {
            // Join session
            await supabase.from('hot_seat_participants').upsert({
                session_id: session.id,
                user_id: userProfile.id,
                status: 'joined'
            })

            // Fetch questions
            const { data: qData } = await supabase
                .from('hot_seat_questions')
                .select('*')
                .eq('session_id', session.id)
                .order('created_at', { ascending: true })

            if (qData) {
                setQuestions(qData)
                const active = qData.find(q => q.status === 'active')
                if (active) setCurrentQuestion(active)
            }

            // Fetch participant count
            const { count } = await supabase
                .from('hot_seat_participants')
                .select('*', { count: 'exact', head: true })
                .eq('session_id', session.id)

            setParticipantCount(count || 0)
        }

        fetchState()
    }, [])

    // Realtime Subscriptions
    useEffect(() => {
        const channel = supabase.channel(`hot-seat:${session.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hot_seat_questions', filter: `session_id=eq.${session.id}` }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setQuestions(prev => [...prev, payload.new as Question])
                    if (!currentQuestion && isHost && status === 'active') {
                        // Auto-activate next question logic could go here, or manual
                    }
                } else if (payload.eventType === 'UPDATE') {
                    const updated = payload.new as Question
                    setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q))

                    if (updated.status === 'active') {
                        setCurrentQuestion(updated)
                        setTimer(30) // Reset timer for new question
                    } else if (['answered', 'skipped', 'timed_out'].includes(updated.status)) {
                        if (currentQuestion?.id === updated.id) {
                            setCurrentQuestion(null)
                            // Clean up timer if needed logic
                        }
                    }
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hot_seat_sessions', filter: `id=eq.${session.id}` }, (payload) => {
                const newStatus = payload.new.status
                setStatus(newStatus)
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hot_seat_participants', filter: `session_id=eq.${session.id}` }, async () => {
                const { count } = await supabase
                    .from('hot_seat_participants')
                    .select('*', { count: 'exact', head: true })
                    .eq('session_id', session.id)
                setParticipantCount(count || 0)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentQuestion, isHost, status])

    // Timer Logic for Active Question
    useEffect(() => {
        if (currentQuestion && status === 'active') {
            timerRef.current = setInterval(() => {
                setTimer(prev => {
                    if (prev <= 1) {
                        handleTimeout()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        } else {
            if (timerRef.current) clearInterval(timerRef.current)
            setTimer(30)
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [currentQuestion, status])

    const handleTimeout = async () => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (!isHost || !currentQuestion) return

        // Call server action for penalty
        await penalizeHotSeatTimeout(session.id, currentQuestion.id)

        // Update local state is handled by realtime subscription usually, 
        // but we can optimistic update or just wait. Server action should update DB.
    }

    // Host Actions
    const startGame = async () => {
        await supabase.from('hot_seat_sessions').update({ status: 'active' }).eq('id', session.id)
    }

    const activateNextQuestion = async () => {
        const nextQ = questions.find(q => q.status === 'pending')
        if (!nextQ) {
            toast.error("No pending questions available")
            return
        }
        await supabase.from('hot_seat_questions').update({ status: 'active' }).eq('id', nextQ.id)
    }

    const submitAnswer = async () => {
        if (!answer.trim() || !currentQuestion) return
        setIsAnswering(true)
        try {
            await supabase.from('hot_seat_questions').update({
                answer: answer.trim(),
                status: 'answered'
            }).eq('id', currentQuestion.id)
            setAnswer("")
            toast.success("Answered!")
        } catch (e) {
            toast.error("Failed to submit answer")
        } finally {
            setIsAnswering(false)
        }
    }

    const skipQuestion = async () => {
        if (!currentQuestion) return
        await penalizeHotSeatTimeout(session.id, currentQuestion.id) // Reuse penalty logic for manual skip without answer
    }

    // Participant Actions
    const sendQuestion = async () => {
        if (!newQuestion.trim()) return
        setIsSending(true)
        try {
            await supabase.from('hot_seat_questions').insert({
                session_id: session.id,
                asker_id: userProfile.id,
                question: newQuestion.trim(),
                status: 'pending'
            })
            setNewQuestion("")
            toast.success("Question submitted!")
        } catch (e) {
            toast.error("Failed to send question")
        } finally {
            setIsSending(false)
        }
    }

    // Derived Lists
    const answeredQuestions = questions.filter(q => ['answered', 'timed_out', 'skipped'].includes(q.status)).reverse()

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white pb-20">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <button onClick={() => router.push('/hot-seat')} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition">
                    <ArrowLeft size={20} />
                </button>
                <div className="text-center">
                    <h2 className="font-bold text-sm flex items-center gap-2 justify-center">
                        <Flame size={16} className="text-amber-500" />
                        {session.name}
                    </h2>
                    <p className="text-[10px] text-white/40 font-mono tracking-widest uppercase">
                        {status === 'waiting' ? 'Waiting for host...' : status === 'active' ? 'LIVE' : 'Ended'}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-white/60">{participantCount}</span>
                </div>
            </div>

            <main className="max-w-md mx-auto p-4 space-y-6">

                {/* Host Controls - Waiting Room */}
                {isHost && status === 'waiting' && (
                    <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
                            <Play className="w-8 h-8 text-amber-500 ml-1" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-white">Ready to start?</h3>
                            <p className="text-sm text-white/40">Wait for players to join, then begin the fire.</p>
                        </div>
                        <button
                            onClick={startGame}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition active:scale-95 shadow-lg shadow-amber-500/20"
                        >
                            Start Game
                        </button>
                    </div>
                )}

                {/* Waiting State (Participants) */}
                {!isHost && status === 'waiting' && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                        <div>
                            <h3 className="font-bold text-white">Waiting for Host</h3>
                            <p className="text-sm text-white/40">The session will begin shortly...</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 max-w-sm w-full">
                            <p className="text-xs text-white/60">
                                💡 Tip: Think of tough questions while you wait! You can earn XP if the host fails to answer.
                            </p>
                        </div>
                    </div>
                )}

                {/* Active Question Card */}
                {status === 'active' && currentQuestion && (
                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-red-600 rounded-[2rem] blur opacity-30 animate-pulse" />
                        <div className="relative bg-[#13131f] border border-amber-500/30 p-6 rounded-[1.8rem] shadow-2xl">
                            {/* Timer Bar */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/5 overflow-hidden rounded-t-[1.8rem]">
                                <motion.div
                                    className="h-full bg-amber-500"
                                    initial={{ width: '100%' }}
                                    animate={{ width: `${(timer / 30) * 100}%` }}
                                    transition={{ duration: 1, ease: "linear" }}
                                />
                            </div>

                            <div className="flex justify-between items-start mb-4 mt-2">
                                <span className="bg-amber-500/20 text-amber-500 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">
                                    Current Question
                                </span>
                                <div className="flex items-center gap-1.5 text-amber-500 font-mono font-bold">
                                    <Clock size={16} />
                                    <span>{timer}s</span>
                                </div>
                            </div>

                            <h3 className="text-xl sm:text-2xl font-black text-white leading-tight mb-6">
                                "{currentQuestion.question}"
                            </h3>

                            {isHost ? (
                                <div className="space-y-3">
                                    <input
                                        autoFocus
                                        value={answer}
                                        onChange={e => setAnswer(e.target.value)}
                                        placeholder="Type your answer fast..."
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition"
                                        onKeyDown={e => e.key === 'Enter' && submitAnswer()}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={skipQuestion}
                                            className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white/40 font-bold rounded-xl text-xs flex-1 transition"
                                        >
                                            Skip (-10 XP)
                                        </button>
                                        <button
                                            onClick={submitAnswer}
                                            disabled={isAnswering || !answer.trim()}
                                            className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex-[2] transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                        >
                                            {isAnswering ? 'Posting...' : 'Answer'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
                                    <Loader2 className="w-6 h-6 text-white/20 animate-spin mx-auto mb-2" />
                                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Host is answering...</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Host: No Active Question State */}
                {isHost && status === 'active' && !currentQuestion && (
                    <div className="p-8 rounded-[1.8rem] bg-white/5 border border-white/5 border-dashed text-center flex flex-col items-center justify-center min-h-[200px]">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                            <MessageCircle className="w-6 h-6 text-white/20" />
                        </div>
                        <h3 className="font-bold text-white mb-1">Queue Empty?</h3>
                        <p className="text-sm text-white/40 mb-4 max-w-[200px]">
                            Waiting for more questions... or grab the next one!
                        </p>
                        <button
                            onClick={activateNextQuestion}
                            className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm flex items-center gap-2"
                        >
                            Next Question <ArrowLeft size={14} className="rotate-180" />
                        </button>
                    </div>
                )}

                {/* Participant Question Input */}
                {!isHost && status === 'active' && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a0a0f]/80 backdrop-blur-xl border-t border-white/10 z-20">
                        <div className="max-w-md mx-auto flex gap-2">
                            <input
                                value={newQuestion}
                                onChange={e => setNewQuestion(e.target.value)}
                                placeholder="Ask a rapid fire question..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition text-sm"
                                onKeyDown={e => e.key === 'Enter' && sendQuestion()}
                            />
                            <button
                                onClick={sendQuestion}
                                disabled={isSending || !newQuestion.trim()}
                                className="p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition disabled:opacity-50 active:scale-95"
                            >
                                {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Q&A Feed */}
                <div className="space-y-4 pt-4 pb-20">
                    <h3 className="text-xs font-black text-white/20 uppercase tracking-widest px-2">History</h3>

                    {answeredQuestions.length === 0 ? (
                        <div className="text-center py-10 opacity-30">
                            <p className="text-sm">No answers yet.</p>
                        </div>
                    ) : (
                        answeredQuestions.map(q => (
                            <div key={q.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 text-[10px] font-bold">
                                        ?
                                    </div>
                                    <p className="text-white font-medium leading-normal text-sm pt-1">
                                        {q.question}
                                    </p>
                                </div>

                                {q.status === 'answered' ? (
                                    <div className="flex items-start gap-3 pl-4 border-l-2 border-amber-500/30 ml-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-amber-400 font-bold text-sm leading-normal">
                                                {q.answer}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 pl-4 ml-4 opacity-50">
                                        <AlertCircle size={14} className="text-red-400" />
                                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                                            {q.status === 'timed_out' ? 'Timed Out (-10 XP)' : 'Skipped (-10 XP)'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    )
}
