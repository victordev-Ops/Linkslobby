"use client"
import { showXPNotification } from '@/components/XPNotification'
import { showAppToast } from '@/components/AppToast'
import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
    ArrowLeft, Flame, Send, Loader2, Clock, Play, MessageCircle, X, Users,
    MoreVertical, Menu, Share2, User, MessageSquare, Ban, ShieldOff, UserPlus,
    Check, SkipForward, Trash2, Lock, Unlock, Search, AlertTriangle
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { penalizeHotSeatTimeout } from "@/actions/hot-seat-xp"
import {
    banParticipant, unbanParticipant, getBannedParticipants,
    closeHotSeatSession, reopenHotSeatSession, deleteHotSeatSession
} from "@/actions/hot-seat"
import { sendFriendRequest, getFriends, sendGameInvite } from "@/actions/friends"
import type { FriendshipWithProfile } from "@/actions/friends"
import type { BannedUser } from "@/actions/hot-seat"
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

type ConfirmAction =
    | { type: 'ban'; userId: string; username: string }
    | { type: 'close' }
    | { type: 'reopen' }
    | { type: 'delete' }
    | null

// Small, friendly relative-time label instead of a flat "Joined"
function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 30) return "Just joined"
    if (seconds < 60) return `Joined ${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `Joined ${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Joined ${hours}h ago`
    const days = Math.floor(hours / 24)
    return `Joined ${days}d ago`
}

export default function HotSeatGameClient({ session, userProfile }: HotSeatGameClientProps) {
    const supabase = useMemo(() => createClient(), [])
    const router = useRouter()

    // Game State
    const [status, setStatus] = useState<'waiting' | 'active' | 'finished'>(session.status)
    const [isClosed, setIsClosed] = useState<boolean>(!!session.is_closed)
    const [isHost] = useState(userProfile.id === session.host_id)
    const [questions, setQuestions] = useState<Question[]>([])
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)

    // Participant State
    const [participantCount, setParticipantCount] = useState(0)
    const [participants, setParticipants] = useState<any[]>([])
    const [showParticipants, setShowParticipants] = useState(false)
    const [participantsTab, setParticipantsTab] = useState<'active' | 'banned'>('active')
    const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([])
    const [isLoadingBanned, setIsLoadingBanned] = useState(false)
    const [unbanningId, setUnbanningId] = useState<string | null>(null)
    const [newQuestion, setNewQuestion] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [menuOpen, setMenuOpen] = useState<string | null>(null)

    // Header menu (share / invite / close / delete)
    const [showHeaderMenu, setShowHeaderMenu] = useState(false)
    const headerMenuRef = useRef<HTMLDivElement | null>(null)

    // Confirm dialog (close / delete / ban)
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
    const [isConfirming, setIsConfirming] = useState(false)

    // Friends Invite State
    const [showInviteFriends, setShowInviteFriends] = useState(false)
    const [friendsList, setFriendsList] = useState<FriendshipWithProfile[]>([])
    const [friendSearch, setFriendSearch] = useState("")
    const [invitedFriendIds, setInvitedFriendIds] = useState<Set<string>>(new Set())
    const [isLoadingFriends, setIsLoadingFriends] = useState(false)
    const [invitingId, setInvitingId] = useState<string | null>(null)

    // Host State
    const [answer, setAnswer] = useState("")
    const [timer, setTimer] = useState(30)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const [isAnswering, setIsAnswering] = useState(false)
    const [isSkipping, setIsSkipping] = useState(false)

    useScrollLock(showParticipants || showInviteFriends || confirmAction !== null)

    // Refs mirroring state that the realtime subscription needs, so the
    // channel can be created once on mount instead of re-subscribing
    // every time a question or the game status changes.
    const currentQuestionRef = useRef(currentQuestion)
    const statusRef = useRef(status)
    useEffect(() => { currentQuestionRef.current = currentQuestion }, [currentQuestion])
    useEffect(() => { statusRef.current = status }, [status])

    // Close the header dropdown on outside click
    useEffect(() => {
        if (!showHeaderMenu) return
        const handler = (e: MouseEvent) => {
            if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
                setShowHeaderMenu(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showHeaderMenu])

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

    const fetchBannedUsers = async () => {
        if (!isHost) return
        setIsLoadingBanned(true)
        try {
            const data = await getBannedParticipants(session.id)
            setBannedUsers(data)
        } catch (e) {
            console.error('Failed to load banned users:', e)
        } finally {
            setIsLoadingBanned(false)
        }
    }

    // Realtime Subscriptions — subscribed once on mount. State the callbacks
    // need is read from refs (or is stable, like isHost) rather than being
    // captured in the dependency array, so the channel never tears down and
    // reconnects mid-game.
    useEffect(() => {
        const channel = supabase.channel(`hot-seat:${session.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hot_seat_questions', filter: `session_id=eq.${session.id}` }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const inserted = payload.new as Question
                    setQuestions(prev => [...prev, inserted])
                    if (!currentQuestionRef.current && isHost && statusRef.current === 'active') {
                        // Same id scheme as the global "Hot Seat: New Question!" toast in
                        // NotificationContext.tsx (`hot_seat:${id}`) — that listener fires
                        // for this exact event too (any hosted session, anywhere in the
                        // app), so without a shared id the host got BOTH toasts stacked
                        // for one INSERT. Same id means whichever fires second just
                        // replaces the first instead of adding a second toast.
                        showAppToast('New question received! 🔥', {
                            id: `hot_seat:${inserted.id}`,
                            icon: Flame,
                            variant: 'warning',
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
                        if (currentQuestionRef.current?.id === updated.id) {
                            setCurrentQuestion(null)
                        }
                    }
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hot_seat_sessions', filter: `id=eq.${session.id}` }, (payload) => {
                setStatus(payload.new.status)
                setIsClosed(!!payload.new.is_closed)
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'hot_seat_sessions', filter: `id=eq.${session.id}` }, () => {
                toast.error("This session was deleted by the host")
                router.push('/hot-seat')
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
        // Intentionally empty — see comment above. `isHost` is derived once
        // from props and never changes for the lifetime of this component.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
    if (!isHost || !currentQuestionRef.current) return

    // Call server action for penalty 
    await penalizeHotSeatTimeout(session.id, currentQuestionRef.current.id)
    
    // NEW: Trigger the toast directly
    showXPNotification(10, "Time Ran Out!", "spend", "XP Lost")
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
    if (!currentQuestion || isSkipping || isAnswering) return
    setIsSkipping(true)
    try {
        // Reuses the same penalty path handleTimeout calls on expiry
        await penalizeHotSeatTimeout(session.id, currentQuestion.id)
        
        // NEW: Trigger the toast directly
        showXPNotification(10, "Question Skipped", "spend", "XP Spent")
    } finally {
        setIsSkipping(false)
    }
    }
    

    const handleBan = (userId: string, username: string) => {
        setMenuOpen(null)
        setConfirmAction({ type: 'ban', userId, username })
    }

    const handleUnban = async (userId: string) => {
        setUnbanningId(userId)
        try {
            const result = await unbanParticipant(session.id, userId)
            if (result.success) {
                toast.success("Participant unbanned")
                setBannedUsers(prev => prev.filter(b => b.id !== userId))
            } else {
                toast.error(result.error)
            }
        } finally {
            setUnbanningId(null)
        }
    }

    const runConfirmedAction = async () => {
        if (!confirmAction) return
        setIsConfirming(true)
        try {
            if (confirmAction.type === 'ban') {
                const result = await banParticipant(session.id, confirmAction.userId)
                if (result.success) {
                    toast.success(`${confirmAction.username} was banned`)
                } else {
                    toast.error(result.error)
                }
            } else if (confirmAction.type === 'close') {
                const result = await closeHotSeatSession(session.id)
                if (result.success) {
                    setIsClosed(true)
                    toast.success("Session closed to new participants")
                } else {
                    toast.error(result.error)
                }
            } else if (confirmAction.type === 'reopen') {
                const result = await reopenHotSeatSession(session.id)
                if (result.success) {
                    setIsClosed(false)
                    toast.success("Session reopened")
                } else {
                    toast.error(result.error)
                }
            } else if (confirmAction.type === 'delete') {
                const result = await deleteHotSeatSession(session.id)
                if (result.success) {
                    toast.success("Session deleted")
                    router.push('/hot-seat')
                } else {
                    toast.error(result.error)
                }
            }
        } finally {
            setIsConfirming(false)
            setConfirmAction(null)
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
        setShowHeaderMenu(false)
    }

    // Load friends list
    useEffect(() => {
        if (isHost) {
            setIsLoadingFriends(true)
            getFriends()
                .then(setFriendsList)
                .catch(console.error)
                .finally(() => setIsLoadingFriends(false))
        }
    }, [isHost])

    const filteredFriends = useMemo(() => {
        const q = friendSearch.trim().toLowerCase()
        if (!q) return friendsList
        return friendsList.filter(f => f.profile.username?.toLowerCase().includes(q))
    }, [friendsList, friendSearch])

    const handleInviteFriend = async (friendUserId: string) => {
        if (invitedFriendIds.has(friendUserId)) return
        setInvitingId(friendUserId)
        try {
            const gameUrl = window.location.href
            const result = await sendGameInvite(friendUserId, 'hot_seat', gameUrl, session.name)
            if (result.success) {
                setInvitedFriendIds(prev => new Set(prev).add(friendUserId))
                toast.success('Invite sent! 🔥')
            } else {
                toast.error(result.error || 'Failed to send invite')
            }
        } finally {
            setInvitingId(null)
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

    const confirmCopy: Record<NonNullable<ConfirmAction>['type'], { title: string; body: string; confirmLabel: string; danger?: boolean }> = {
        ban: {
            title: 'Ban this participant?',
            body: `${confirmAction?.type === 'ban' ? confirmAction.username : ''} won't be able to rejoin unless you unban them later.`,
            confirmLabel: 'Ban',
            danger: true
        },
        close: {
            title: 'Close this session?',
            body: 'No new participants will be able to join. Everyone already in the session keeps playing as normal.',
            confirmLabel: 'Close session'
        },
        reopen: {
            title: 'Reopen this session?',
            body: 'New participants will be able to join again using the share link.',
            confirmLabel: 'Reopen session'
        },
        delete: {
            title: 'Delete this session?',
            body: 'This permanently removes the session, its questions, and its participant list for everyone. This can\'t be undone.',
            confirmLabel: 'Delete forever',
            danger: true
        }
    }

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
                    <p className="text-[10px] text-white/40 font-mono tracking-widest uppercase flex items-center gap-1.5 justify-center">
                        {participantCount} Players • {status}
                        {isClosed && (
                            <span className="inline-flex items-center gap-0.5 text-amber-500">
                                <Lock size={9} /> Closed
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { setShowParticipants(true); setParticipantsTab('active') }}
                        className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition relative"
                        title="Participants"
                    >
                        <Users size={18} />
                        {participantCount > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full border border-[#0a0a0f]" />
                        )}
                    </button>

                    {/* Grouped actions menu: share, invite, close/reopen, delete */}
                    <div className="relative" ref={headerMenuRef}>
                        <button
                            onClick={() => setShowHeaderMenu(v => !v)}
                            className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition"
                            title="More options"
                        >
                            <Menu size={18} />
                        </button>
                        <AnimatePresence>
                            {showHeaderMenu && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                                    className="absolute right-0 top-full mt-2 w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden backdrop-blur-xl"
                                >
                                    <div className="p-1.5 space-y-0.5">
                                        <button
                                            onClick={shareLink}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition"
                                        >
                                            <Share2 size={16} /> Share Link
                                        </button>
                                        {isHost && (
                                            <button
                                                onClick={() => { setShowInviteFriends(true); setShowHeaderMenu(false) }}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition"
                                            >
                                                <UserPlus size={16} /> Invite Friends
                                            </button>
                                        )}
                                        {isHost && (
                                            <>
                                                <div className="h-px bg-white/5 my-1" />
                                                {isClosed ? (
                                                    <button
                                                        onClick={() => { setConfirmAction({ type: 'reopen' }); setShowHeaderMenu(false) }}
                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition"
                                                    >
                                                        <Unlock size={16} /> Reopen Session
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => { setConfirmAction({ type: 'close' }); setShowHeaderMenu(false) }}
                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition"
                                                    >
                                                        <Lock size={16} /> Close Session
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setConfirmAction({ type: 'delete' }); setShowHeaderMenu(false) }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition"
                                                >
                                                    <Trash2 size={16} /> Delete Session
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
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
                                                disabled={isSkipping || isAnswering}
                                                className="px-4 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 font-bold rounded-xl text-xs flex-1 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                                            >
                                                {isSkipping ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <SkipForward size={14} />
                                                )}
                                                Skip (-10 XP)
                                            </button>
                                            <button
                                                onClick={submitAnswer}
                                                disabled={isAnswering || isSkipping || !answer.trim()}
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
                            className="fixed right-0 top-0 bottom-0 w-72 bg-[#13131f] border-l border-white/10 z-50 p-4 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-4">
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

                            {/* Tabs: Active / Banned (host only) */}
                            {isHost && (
                                <div className="flex items-center gap-1 mb-4 p-1 bg-white/5 rounded-xl">
                                    <button
                                        onClick={() => setParticipantsTab('active')}
                                        className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition ${participantsTab === 'active' ? 'bg-amber-500 text-white' : 'text-white/40 hover:text-white/70'}`}
                                    >
                                        Active ({participantCount})
                                    </button>
                                    <button
                                        onClick={() => { setParticipantsTab('banned'); if (bannedUsers.length === 0) fetchBannedUsers() }}
                                        className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition ${participantsTab === 'banned' ? 'bg-red-500 text-white' : 'text-white/40 hover:text-white/70'}`}
                                    >
                                        Banned
                                    </button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                {participantsTab === 'active' ? (
                                    participants.length === 0 ? (
                                        <p className="text-center text-white/30 text-sm py-10">No one here yet...</p>
                                    ) : (
                                        participants.map(p => {
                                            const isSelf = p.id === userProfile.id
                                            const isRowHost = session.host_id === p.id
                                            return (
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
                                                            <div className="flex items-center gap-1.5">
                                                                {isRowHost ? (
                                                                    <span className="text-[9px] font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase tracking-wider">Host</span>
                                                                ) : (
                                                                    <p className="text-[10px] text-white/40">
                                                                        {isSelf ? 'You' : timeAgo(p.joined_at)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Hosts don't get a moderation menu on their own row */}
                                                        {!isRowHost && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setMenuOpen(menuOpen === p.id ? null : p.id)
                                                                }}
                                                                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition"
                                                            >
                                                                <MoreVertical size={16} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Dropdown Menu */}
                                                    <AnimatePresence>
                                                        {menuOpen === p.id && !isRowHost && (
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
                                                                    {!isSelf && (
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
                                                                    )}
                                                                    {!isSelf && (
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
                                                                    {isHost && !isSelf && (
                                                                        <button
                                                                            onClick={() => handleBan(p.id, p.username)}
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
                                            )
                                        })
                                    )
                                ) : (
                                    // Banned tab
                                    isLoadingBanned ? (
                                        <div className="py-12 flex flex-col items-center gap-2">
                                            <Loader2 size={24} className="animate-spin text-white/30" />
                                        </div>
                                    ) : bannedUsers.length === 0 ? (
                                        <div className="py-12 text-center">
                                            <ShieldOff size={28} className="text-white/10 mx-auto mb-3" />
                                            <p className="text-sm text-white/40 font-medium">No one's banned</p>
                                        </div>
                                    ) : (
                                        bannedUsers.map(b => (
                                            <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 opacity-60">
                                                    {b.avatar_url ? (
                                                        <img src={b.avatar_url} alt={b.username} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center font-bold text-white/50 text-sm">
                                                            {b.username?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-white/70 text-sm truncate">{b.username}</p>
                                                    <p className="text-[10px] text-white/30">Banned {timeAgo(b.banned_at).replace('Joined ', '')}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleUnban(b.id)}
                                                    disabled={unbanningId === b.id}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white/80 transition disabled:opacity-50"
                                                >
                                                    {unbanningId === b.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldOff size={12} />}
                                                    Unban
                                                </button>
                                            </div>
                                        ))
                                    )
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Invite Friends Drawer */}
            <AnimatePresence>
                {showInviteFriends && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowInviteFriends(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed left-0 right-0 bottom-0 max-h-[75vh] bg-[#13131f] border-t border-white/10 z-50 rounded-t-3xl flex flex-col safe-area-bottom"
                        >
                            {/* Handle bar */}
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 bg-white/20 rounded-full" />
                            </div>

                            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    <UserPlus size={18} className="text-amber-500" />
                                    Invite Friends
                                </h3>
                                <button
                                    onClick={() => setShowInviteFriends(false)}
                                    className="p-2 rounded-full hover:bg-white/5 transition"
                                >
                                    <X size={20} className="text-white/60" />
                                </button>
                            </div>

                            {friendsList.length > 0 && (
                                <div className="px-4 pt-3">
                                    <div className="relative">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                        <input
                                            value={friendSearch}
                                            onChange={e => setFriendSearch(e.target.value)}
                                            placeholder="Search friends..."
                                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto px-4 py-3">
                                {isLoadingFriends ? (
                                    <div className="py-12 flex flex-col items-center gap-2">
                                        <Loader2 size={24} className="animate-spin text-white/30" />
                                        <p className="text-xs text-white/40">Loading friends...</p>
                                    </div>
                                ) : friendsList.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <Users size={32} className="text-white/10 mx-auto mb-3" />
                                        <p className="text-sm text-white/40 font-medium">No friends yet</p>
                                        <p className="text-xs text-white/25 mt-1">Add friends to invite them!</p>
                                    </div>
                                ) : filteredFriends.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <Search size={28} className="text-white/10 mx-auto mb-3" />
                                        <p className="text-sm text-white/40 font-medium">No matches for "{friendSearch}"</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredFriends.map((f) => {
                                            const isInvited = invitedFriendIds.has(f.profile.id)
                                            const isInvitingThis = invitingId === f.profile.id
                                            return (
                                                <div key={f.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                                                            {f.profile.avatar_url ? (
                                                                <img src={f.profile.avatar_url} alt={f.profile.username} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center font-bold text-white text-sm">
                                                                    {f.profile.username?.[0]?.toUpperCase() || '?'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-sm text-white font-medium truncate">
                                                            {f.profile.username}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleInviteFriend(f.profile.id)}
                                                        disabled={isInvited || isInvitingThis}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex-shrink-0 ${
                                                            isInvited
                                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg hover:shadow-amber-500/30'
                                                        } disabled:opacity-70 disabled:cursor-not-allowed`}
                                                    >
                                                        {isInvitingThis ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : isInvited ? (
                                                            <>
                                                                <Check size={12} />
                                                                Sent
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserPlus size={12} />
                                                                Invite
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Confirm Dialog: ban / close / reopen / delete */}
            <AnimatePresence>
                {confirmAction && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isConfirming && setConfirmAction(null)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl z-[80] p-6"
                        >
                            <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-4 ${confirmCopy[confirmAction.type].danger ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                                <AlertTriangle size={20} className={confirmCopy[confirmAction.type].danger ? 'text-red-400' : 'text-amber-500'} />
                            </div>
                            <h3 className="font-bold text-lg text-white mb-1.5">{confirmCopy[confirmAction.type].title}</h3>
                            <p className="text-sm text-white/50 leading-relaxed mb-6">{confirmCopy[confirmAction.type].body}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    disabled={isConfirming}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-bold text-sm transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={runConfirmedAction}
                                    disabled={isConfirming}
                                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                                        confirmCopy[confirmAction.type].danger
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                                    }`}
                                >
                                    {isConfirming && <Loader2 size={14} className="animate-spin" />}
                                    {confirmCopy[confirmAction.type].confirmLabel}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
