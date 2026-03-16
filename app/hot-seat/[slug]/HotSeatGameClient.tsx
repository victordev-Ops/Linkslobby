"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ArrowLeft, Flame, Send, Loader2, Clock, Play, AlertCircle, MessageCircle, X, Users, Sparkles, MoreVertical, Share2, User, MessageSquare, Ban } from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { penalizeHotSeatTimeout } from "@/actions/hot-seat-xp"
import { banParticipant } from "@/actions/hot-seat"
import { sendFriendRequest } from "@/actions/friends"
import { useScrollLock } from "@/hooks/useScrollLock"
import VerifiedBadge from "@/components/VerifiedBadge"

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
    const [participants, setParticipants] = useState<any[]>([])
    const [showParticipants, setShowParticipants] = useState(false)
    const [newQuestion, setNewQuestion] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [menuOpen, setMenuOpen] = useState<string | null>(null)

    // Host State
    const [answer, setAnswer] = useState("")
    const [timer, setTimer] = useState(30)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const [isAnswering, setIsAnswering] = useState(false)

    useScrollLock(showParticipants)

    // Initial Data Fetch
    useEffect(() => {
        const fetchState = async () => {
            // Join session
            const { joinHotSeatSession } = await import('@/actions/hot-seat')
            const result = await joinHotSeatSession(session.id)
            if (result && !result.success) {
                toast.error(result.error)
                router.push('/hot-seat')
                return
            }

            // Fetch questions
            const { data: qData, error: qError } = await supabase
                .from('hot_seat_questions')
                .select('*')
                .eq('session_id', session.id)
                .order('created_at', { ascending: true })

            if (qError) {
                console.error('Error fetching questions:', qError)
                toast.error("Failed to load questions")
            }

            if (qData) {
                setQuestions(qData)
                const active = qData.find(q => q.status === 'active')
                if (active) setCurrentQuestion(active)
            }

            // Fetch participants
            fetchParticipants()
        }

        fetchState()
    }, [])

    const fetchParticipants = async () => {
        const { data, count, error } = await supabase
            .from('hot_seat_participants')
            .select('*, user:profiles!hot_seat_participants_user_id_fkey(username, slug, id, is_pro, avatar_url)', { count: 'exact' })
            .eq('session_id', session.id)

        if (error) {
            console.error('Error fetching participants:', error)
            return
        }

        if (data) {
            setParticipants(data.map(p => {
                const userObj = Array.isArray(p.user) ? p.user[0] : p.user
                return {
                    ...userObj,
                    id: p.user_id, // Ensure we keep the participant's user_id as the canonical id
                    joined_at: p.created_at
                }
            }))
        }
        setParticipantCount(count || 0)
    }

    // Realtime Subscriptions
    useEffect(() => {
        const channel = supabase.channel(`hot-seat:${session.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hot_seat_questions', filter: `session_id=eq.${session.id}` }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setQuestions(prev => [...prev, payload.new as Question])
                    if (!currentQuestion && isHost && status === 'active') {
                        toast('New question received!', {
                            icon: '🔥',
                            description: 'A new question has been added to the queue.'
                        })
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
                        }
                    }
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hot_seat_sessions', filter: `id=eq.${session.id}` }, (payload) => {
                const newStatus = payload.new.status
                setStatus(newStatus)
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hot_seat_participants', filter: `session_id=eq.${session.id}` }, async () => {
                await fetchParticipants()
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hot_seat_bans', filter: `session_id=eq.${session.id}` }, (payload) => {
                if (payload.new.user_id === userProfile.id) {
                    toast.error("You have been banned from this session")
                    router.push('/hot-seat')
                }
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

    const handleBan = async (userId: string) => {
        if (!window.confirm("Are you sure you want to ban this participant?")) return
        const result = await banParticipant(session.id, userId)
        if (result.success) {
            toast.success("Participant banned")
            setMenuOpen(null)
        } else {
            toast.error(result.error)
        }
    }

    const shareLink = async () => {
        const url = window.location.href
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join ${session.name} on Hot Seat!`,
                    url: url
                })
            } catch (e) {
                console.error("Error sharing:", e)
            }
        } else {
            navigator.clipboard.writeText(url)
            toast.success("Link copied to clipboard!")
        }
    }

    // Participant Actions
    const sendQuestion = async () => {
        if (!newQuestion.trim()) return
        setIsSending(true)
        try {
            const { error } = await supabase.from('hot_seat_questions').insert({
                session_id: session.id,
                asker_id: userProfile.id,
                question: newQuestion.trim(),
                status: 'pending'
            })

            if (error) throw error

            setNewQuestion("")
            toast.success("Question submitted!")
        } catch (e) {
            console.error('Error sending question:', e)
            toast.error("Failed to send question")
        } finally {
            setIsSending(false)
        }
    }

    // Derived Lists
    const pendingQuestions = questions.filter(q => q.status === 'pending')
    const answeredQuestions = questions.filter(q => ['answered', 'timed_out', 'skipped'].includes(q.status)).reverse()

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0a0a0f] text-white overflow-hidden relative">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-600/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[100px] rounded-full" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <button onClick={() => router.push('/hot-seat')} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition">
                    <ArrowLeft size={20} />
                </button>
                <div className="text-center">
                    <h2 className="font-bold text-sm flex items-center gap-2 justify-center">
                        <Flame size={16} className="text-amber-500" />
                        {session.name}
                    </h2>
                    <p className="text-[10px] text-white/40 font-mono tracking-widest uppercase">
                        {participantCount} Players • {status}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={shareLink}
                        className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition"
                        title="Invite Friends"
                    >
                        <Share2 size={18} />
                    </button>
                    <button
                        onClick={() => setShowParticipants(true)}
                        className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition relative"
                    >
                        <Users size={18} />
                        {participantCount > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full border border-[#0a0a0f]" />
                        )}
                    </button>
                </div>
            </div>

            {/* Scrollable Game Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 px-4 pt-6 pb-12 space-y-8">
                <div className="max-w-md mx-auto space-y-8">
                    {/* Lobby/Waiting Area */}
                    {status === 'waiting' && (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full animate-pulse" />
                                <div className="relative w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                    <Flame size={48} className="text-amber-500 animate-bounce" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-xl text-white">Waiting for Host</h3>
                                <p className="text-sm text-white/40 max-w-[280px] mx-auto">
                                    The session will begin once the host starts the game. Get ready!
                                </p>
                            </div>
                            {isHost && (
                                <button
                                    onClick={startGame}
                                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-2xl transition shadow-xl shadow-amber-500/20 flex items-center gap-2"
                                >
                                    <Play size={18} fill="currentColor" /> Start Game
                                </button>
                            )}
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5 max-w-sm w-full mx-auto">
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

                    {/* Upcoming Questions List */}
                    {status === 'active' && pendingQuestions.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Upcoming Questions</h3>
                                <span className="bg-white/5 text-white/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {pendingQuestions.length} pending
                                </span>
                            </div>
                            <div className="space-y-2">
                                {pendingQuestions.map((q, idx) => (
                                    <div key={q.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-3">
                                        <span className="text-[10px] font-mono text-white/20 w-4">{idx + 1}.</span>
                                        <p className="text-xs text-white/60 truncate flex-1">{q.question}</p>
                                        {isHost && (
                                            <button
                                                onClick={async () => {
                                                    await supabase.from('hot_seat_questions').update({ status: 'active' }).eq('id', q.id)
                                                }}
                                                className="text-[10px] font-bold text-amber-500 hover:text-amber-400 uppercase tracking-wider px-2 py-1 rounded-lg hover:bg-amber-500/10 transition"
                                            >
                                                Bring Forward
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Q&A Feed */}
                    <div className="space-y-4 pt-4">
                        <h3 className="text-xs font-black text-white/20 uppercase tracking-widest px-2">History</h3>
                        <AnimatePresence mode="popLayout">
                            {answeredQuestions.length === 0 ? (
                                <div className="py-12 text-center text-white/20">
                                    <p className="text-sm">No answered questions yet</p>
                                </div>
                            ) : (
                                answeredQuestions.map(q => (
                                    <motion.div
                                        key={q.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden mb-4"
                                    >
                                        <div className="p-4 border-b border-white/5 bg-white/5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-1 h-3 bg-amber-500 rounded-full" />
                                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Question</span>
                                            </div>
                                            <p className="text-sm font-bold text-white leading-relaxed">"{q.question}"</p>
                                        </div>
                                        <div className="p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`w-1 h-3 rounded-full ${q.status === 'answered' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${q.status === 'answered' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {q.status === 'answered' ? 'Answer' : q.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className={`text-sm leading-relaxed ${q.status === 'answered' ? 'text-white/80' : 'text-white/30 italic'}`}>
                                                {q.answer || `No answer provided (${q.status.replace('_', ' ')})`}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Participant Question Input (Fixed Footer) */}
            {!isHost && status === 'active' && (
                <div className="flex-shrink-0 p-4 bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/10 z-20 safe-area-bottom">
                    <div className="max-w-md mx-auto flex gap-2">
                        <input
                            value={newQuestion}
                            onChange={e => setNewQuestion(e.target.value)}
                            placeholder="Ask a rapid fire question..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition text-[16px]"
                            onKeyDown={e => e.key === 'Enter' && sendQuestion()}
                        />
                        <button
                            onClick={sendQuestion}
                            disabled={isSending || !newQuestion.trim()}
                            className="p-3.5 bg-gradient-to-tr from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-white rounded-xl transition disabled:opacity-50 active:scale-95 shadow-lg shadow-amber-900/20"
                        >
                            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Participants Modal/Drawer */}
            <AnimatePresence>
                {showParticipants && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setShowParticipants(false)
                                setMenuOpen(null)
                            }}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 20 }}
                            className="fixed right-0 top-0 bottom-0 w-64 bg-[#13131f] border-l border-white/10 z-50 p-4 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    <Users size={18} /> Participants
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowParticipants(false)
                                        setMenuOpen(null)
                                    }}
                                    className="p-2 rounded-full hover:bg-white/5 transition"
                                >
                                    <X size={20} className="text-white/60" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                {participants.length === 0 ? (
                                    <p className="text-center text-white/30 text-sm py-10">No one here yet...</p>
                                ) : (
                                    participants.map(p => (
                                        <div key={p.id} className="relative group">
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 transition group-hover:bg-white/10">
                                                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                                                    {p.avatar_url ? (
                                                        <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center font-bold text-white text-sm">
                                                            {p.username?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="font-bold text-white text-sm truncate">{p.username}</p>
                                                        {p.is_pro && <VerifiedBadge size={14} />}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {session.host_id === p.id ? (
                                                            <span className="text-[9px] font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase tracking-wider">Host</span>
                                                        ) : (
                                                            <p className="text-[10px] text-white/40">Joined</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 3-dot menu button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setMenuOpen(menuOpen === p.id ? null : p.id)
                                                    }}
                                                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition"
                                                >
                                                    <MoreVertical size={16} />
                                                </button>
                                            </div>

                                            {/* Dropdown Menu */}
                                            <AnimatePresence>
                                                {menuOpen === p.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden backdrop-blur-xl"
                                                    >
                                                        <div className="p-1.5 space-y-0.5">
                                                            <button
                                                                onClick={() => {
                                                                    const identifier = p.slug || p.username;
                                                                    router.push(`/u/${identifier}`);
                                                                    setMenuOpen(null);
                                                                    setShowParticipants(false);
                                                                }}
                                                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition"
                                                            >
                                                                <User size={16} /> View Profile
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const identifier = p.username || p.id;
                                                                    router.push(`/messages/${identifier}`);
                                                                    setMenuOpen(null);
                                                                    setShowParticipants(false);
                                                                }}
                                                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition"
                                                            >
                                                                <MessageSquare size={16} /> Message
                                                            </button>
                                                            {p.id !== userProfile.id && (
                                                                <button
                                                                    onClick={async () => {
                                                                        const result = await sendFriendRequest(p.id);
                                                                        if (result.success) {
                                                                            toast.success('Friend request sent!');
                                                                        } else {
                                                                            toast.error(result.error || 'Failed to send request');
                                                                        }
                                                                        setMenuOpen(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition"
                                                                >
                                                                    <Users size={16} /> Add Friend
                                                                </button>
                                                            )}
                                                            {isHost && session.host_id !== p.id && (
                                                                <button
                                                                    onClick={() => handleBan(p.id)}
                                                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition border-t border-white/5 mt-1 pt-2"
                                                                >
                                                                    <Ban size={16} /> Ban Participant
                                                                </button>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

