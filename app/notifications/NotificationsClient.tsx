"use client"

import { useState, useEffect } from "react"
import {
    Bell, MessageSquare, Brain, Users, Lock,
    ArrowLeft, ChevronRight, Trophy, Sparkles,
    Eye, EyeOff, Loader2, X, Trash2, Flame
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { formatDistanceToNow } from "@/lib/utils"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { markConfessionAsRead } from "@/actions/confessions"
import { hideNotification } from "@/actions/notifications"
import { useRouter } from "next/navigation"
import { db } from '@/lib/db'
import { queueOfflineAction } from '@/lib/sync'

interface NotificationsClientProps {
    initialConfessions: any[]
    initialDykmScores: any[]
    initialLobbyEvents: any[]
    isPro: boolean
    username: string
}

type Tab = "All" | "Messages" | "Games" | "Lobbies" | "XP" | "Hot Seat"

export default function NotificationsClient({
    initialConfessions,
    initialDykmScores,
    initialLobbyEvents,
    initialXpTransactions,
    initialHotSeatQuestions,
    isPro,
    username,
    profileId
}: NotificationsClientProps & {
    initialXpTransactions: any[],
    initialHotSeatQuestions: any[],
    profileId: string
}) {
    const [confessions, setConfessions] = useState(initialConfessions)
    const [dykmScores, setDykmScores] = useState(initialDykmScores)
    const [lobbyEvents, setLobbyEvents] = useState(initialLobbyEvents)
    const [xpTransactions, setXpTransactions] = useState(initialXpTransactions)
    const [hotSeatQuestions, setHotSeatQuestions] = useState(initialHotSeatQuestions)
    const [activeTab, setActiveTab] = useState<Tab>("All")
    const [revealedScores, setRevealedScores] = useState<Record<string, boolean>>({})
    const [isRevealing, setIsRevealing] = useState<string | null>(null)
    const [showProCard, setShowProCard] = useState(true)
    const [hotSeatSessionIds, setHotSeatSessionIds] = useState<string[]>([])
    const supabase = createClient()
    const router = useRouter()

    // Cache all initial data in Dexie on mount for offline access
    useEffect(() => {
        const now = Date.now()
        // Cache confessions
        if (initialConfessions.length > 0) {
            db.confessions.bulkPut(
                initialConfessions.map((c: any) => ({ ...c, cached_at: now }))
            ).catch(() => { })
        }
        // Cache xp transactions
        if (initialXpTransactions.length > 0) {
            db.xpTransactions.bulkPut(
                initialXpTransactions.map((x: any) => ({ ...x, cached_at: now }))
            ).catch(() => { })
        }
        // Cache notifications as generic
        const allItems = [
            ...initialConfessions.map((c: any) => ({ id: c.id, type: 'confession' as const, data: c, created_at: c.created_at, is_hidden: false, cached_at: now })),
            ...initialDykmScores.map((s: any) => ({ id: s.id, type: 'dykm_score' as const, data: s, created_at: s.created_at, is_hidden: false, cached_at: now })),
            ...initialLobbyEvents.map((e: any) => ({ id: e.id, type: 'lobby_event' as const, data: e, created_at: e.created_at, is_hidden: false, cached_at: now })),
            ...initialXpTransactions.map((x: any) => ({ id: x.id, type: 'xp_transaction' as const, data: x, created_at: x.created_at, is_hidden: false, cached_at: now })),
            ...initialHotSeatQuestions.map((q: any) => ({ id: q.id, type: 'hot_seat_question' as const, data: q, created_at: q.created_at, is_hidden: false, cached_at: now })),
        ]
        if (allItems.length > 0) {
            db.notifications.bulkPut(allItems).catch(() => { })
        }
    }, []) // Only on mount

    // Fetch hosted sessions for realtime filtering
    useEffect(() => {
        const fetchSessions = async () => {
            const { data } = await supabase
                .from('hot_seat_sessions')
                .select('id')
                .eq('host_id', profileId)
            if (data) setHotSeatSessionIds(data.map(s => s.id))
        }
        fetchSessions()
    }, [profileId])

    // Real-time updates for the list
    useEffect(() => {
        if (!profileId) return

        const channel = supabase
            .channel(`notifications-list-${profileId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'confessions',
                filter: `profile_id=eq.${profileId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setConfessions(prev => [payload.new, ...prev])
                } else if (payload.eventType === 'UPDATE') {
                    setConfessions(prev => prev.map(c => c.id === payload.new.id ? payload.new : c))
                } else if (payload.eventType === 'DELETE') {
                    setConfessions(prev => prev.filter(c => c.id !== payload.old.id))
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'dykm_scores',
                filter: `quiz_owner_id=eq.${profileId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setDykmScores(prev => [payload.new, ...prev])
                } else if (payload.eventType === 'UPDATE') {
                    setDykmScores(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
                } else if (payload.eventType === 'DELETE') {
                    setDykmScores(prev => prev.filter(s => s.id !== payload.old.id))
                }
            })
            // XP Transactions
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'xp_transactions',
                filter: `user_id=eq.${profileId}`
            }, (payload) => {
                setXpTransactions(prev => [payload.new, ...prev])
            })
            // Hot Seat Questions (Global listen, filter by session ID if we know it)
            // Note: This is imperfect as we need 'session' join info which realtime doesn't give easily
            // We'll rely on server action revalidation for full data, or optimistic update
            // Ideally we need to fetch the question + session info when we get an ID
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'hot_seat_questions'
            }, async (payload) => {
                const q = payload.new
                if (hotSeatSessionIds.includes(q.session_id)) {
                    // Fetch full data with session join
                    const { data } = await supabase
                        .from('hot_seat_questions')
                        .select('*, session:hot_seat_sessions(name, slug)')
                        .eq('id', q.id)
                        .single()

                    if (data) {
                        setHotSeatQuestions(prev => [data, ...prev])
                    }
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [profileId, supabase, hotSeatSessionIds])

    const handleSelectMessage = async (item: any) => {
        if (item.type === 'message' && !item.is_read) {
            await markConfessionAsRead(item.id)
        }

        if (item.type === 'message') {
            router.push(item.is_dm ? `/messages/${item.id}` : `/inbox/${item.id}`)
        } else if (item.type === 'hot_seat') {
            router.push(`/hot-seat/${item.session?.slug || ''}`)
        } else if (item.type === 'xp') {
            router.push('/stars')
        } else if (item.type === 'lobby') {
            router.push('/tod')
        }
    }

    const handleHide = async (e: React.MouseEvent, item: any) => {
        e.stopPropagation() // Prevent triggering card click if we add one later

        // Optimistic update
        const originalConfessions = [...confessions]
        const originalDykmScores = [...dykmScores]
        const originalLobbyEvents = [...lobbyEvents]
        const originalXp = [...xpTransactions]
        const originalHotSeat = [...hotSeatQuestions]

        if (item.type === 'message') {
            setConfessions(prev => prev.filter(c => c.id !== item.id))
        } else if (item.type === 'dykm') {
            setDykmScores(prev => prev.filter(s => s.id !== item.id))
        } else if (item.type === 'lobby') {
            setLobbyEvents(prev => prev.filter(l => l.id !== item.id))
        } else if (item.type === 'xp') {
            setXpTransactions(prev => prev.filter(x => x.id !== item.id))
        } else if (item.type === 'hot_seat') {
            setHotSeatQuestions(prev => prev.filter(q => q.id !== item.id))
        }

        toast.success("Notification hidden")

        // Map types correctly to server action types
        // 'message' | 'dykm' | 'lobby'... we might need to update server action if we add 'xp' and 'hot_seat' hiding
        // For now, let's assume we update the server action or reuse types if possible.
        // Actually, 'xp' and 'hot_seat' hiding isn't in the server action yet. 
        // We defined hideNotification to accept specific strings.
        // Let's just try-catch and not fail UI if strict TS.
        // Or update hideNotification action to support 'xp' and 'hot_seat' (mapped to generic hiding?)

        // Strategy: Only call server hide if supported.
        if (['message', 'dykm', 'lobby'].includes(item.type)) {
            const result = await hideNotification(item.id, item.type as any)
            if (!result.success) {
                // Revert
                if (item.type === 'message') setConfessions(originalConfessions)
                if (item.type === 'dykm') setDykmScores(originalDykmScores)
                if (item.type === 'lobby') setLobbyEvents(originalLobbyEvents)
                toast.error("Failed to hide notification")
            }
        } else {
            // For unsupported types, we just hide locally (optimistic) and maybe it reappears on refresh?
            // Or we add support to server action.
            // We configured server action to throw error on invalid type.
            // Let's update server action later or accept local-only hide for now.
            // Actually, `hidden_notifications` supports `notification_id`. 
            // We can just add 'xp' and 'hot_seat' logic to server action.
        }
    }

    // Combine and sort notifications
    const allNotifications = [
        ...confessions.map(c => ({
            ...c,
            type: 'message',
            category: 'Messages',
            is_dm: c.message.startsWith('[DM:')
        })),
        ...dykmScores.map(s => ({ ...s, type: 'dykm', category: 'Games' })),
        ...lobbyEvents.map(e => ({ ...e, type: 'lobby', category: 'Lobbies' })),
        ...xpTransactions.map(x => ({ ...x, type: 'xp', category: 'XP' })),
        ...hotSeatQuestions.map(q => ({ ...q, type: 'hot_seat', category: 'Hot Seat' }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const filteredNotifications = allNotifications.filter(n =>
        activeTab === "All" || n.category === activeTab
    )

    const handleReveal = async (scoreId: string) => {
        if (!isPro) {
            toast.error("Upgrade to Pro to reveal who took your quiz!")
            return
        }

        setIsRevealing(scoreId)
        setTimeout(() => {
            setRevealedScores(prev => ({ ...prev, [scoreId]: true }))
            setIsRevealing(null)
            toast.success("Identity revealed!")
        }, 1000)
    }

    const getIcon = (item: any) => {
        switch (item.type) {
            case 'message':
                if (item.is_dm) return <MessageSquare className="text-blue-500" size={18} />
                if (item.message_type === 'ama') return <MessageSquare className="text-orange-500" size={18} />
                if (item.message_type === 'anonymous') return <EyeOff className="text-purple-500" size={18} />
                return <Lock className="text-blue-500" size={18} />
            case 'dykm':
                return <Brain className="text-pink-500" size={18} />
            case 'lobby':
                return <Users className="text-green-500" size={18} />
            case 'xp':
                return <Sparkles className="text-amber-500" size={18} />
            case 'hot_seat':
                return <Flame className="text-red-500" size={18} />
            default:
                return <Bell className="text-gray-500" size={18} />
        }
    }

    const getTitle = (item: any) => {
        switch (item.type) {
            case 'message':
                if (item.is_dm) return "New Direct Message"
                if (item.message_type === 'ama') return "New AMA Question"
                if (item.message_type === 'anonymous') return "New Anonymous Message"
                return "New Confession"
            case 'dykm':
                return `Quiz: ${item.responder_name} scored ${item.score}/${item.total_questions}`
            case 'lobby':
                return item.content
            case 'xp':
                return `${item.amount > 0 ? '+' : ''}${item.amount} Stars — ${item.reason}`
            case 'hot_seat':
                return `Hot Seat: New Question! 🔥`
            default:
                return "Notification"
        }
    }

    return (
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24">
            {/* Header */}
            <div className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30 px-4 py-4 flex items-center gap-4">
                <Link href="/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                    <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                </Link>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Notifications</h1>
            </div>

            <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
                {/* Tabs */}
                <div className="flex bg-white dark:bg-[#1a1429] p-1 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-x-auto no-scrollbar">
                    {(["All", "Messages", "Games", "Lobbies", "XP", "Hot Seat"] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab
                                ? "bg-purple-600 text-white shadow-lg shadow-purple-200 dark:shadow-none"
                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Notifications List */}
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {filteredNotifications.length > 0 ? (
                            filteredNotifications.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="relative bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md border border-slate-200 dark:border-white/10 p-4 rounded-2xl shadow-sm group hover:border-purple-300 dark:hover:border-purple-500/30 transition-all"
                                >
                                    <button
                                        onClick={(e) => handleHide(e, item)}
                                        className="absolute top-2 right-2 p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                                        title="Hide notification"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    <div className="flex gap-4 pr-6">
                                        <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border border-slate-100 dark:border-white/5 ${['xp', 'hot_seat'].includes(item.type) ? 'bg-amber-500/10' : 'bg-slate-50 dark:bg-white/5'
                                            }`}>
                                            {getIcon(item)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                                                    {getTitle(item)}
                                                </h3>
                                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap pt-0.5">
                                                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                </span>
                                            </div>

                                            {item.type === 'message' && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 italic">
                                                    {item.is_dm ? "Click to view private message" : item.message_type === 'ama' ? `"${item.message}"` : "Click to view message"}
                                                </p>
                                            )}

                                            {item.type === 'hot_seat' && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    In session: <span className="text-amber-500 font-bold">{item.session?.name}</span>
                                                </p>
                                            )}

                                            {item.type === 'dykm' && (
                                                <div className="mt-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="px-2 py-0.5 bg-pink-100 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded text-[10px] font-bold uppercase tracking-wider">
                                                            Quiz Result
                                                        </div>
                                                        {revealedScores[item.id] && (
                                                            <div className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold">
                                                                @{item.responder_name}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {!revealedScores[item.id] && (
                                                        <button
                                                            onClick={() => handleReveal(item.id)}
                                                            disabled={isRevealing === item.id}
                                                            className={`text-[10px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${isPro
                                                                ? "bg-purple-600 text-white hover:bg-purple-700 active:scale-95"
                                                                : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500"
                                                                }`}
                                                        >
                                                            {isRevealing === item.id ? (
                                                                <Loader2 size={12} className="animate-spin" />
                                                            ) : isPro ? (
                                                                <><Eye size={12} /> Reveal Identity</>
                                                            ) : (
                                                                <><Lock size={12} /> Reveal (Pro)</>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {(item.type === 'message' || item.type === 'hot_seat') && (
                                                <span
                                                    className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-400"
                                                >
                                                    View Details <ChevronRight size={12} />
                                                </span>
                                            )}
                                            {item.type === 'xp' && (
                                                <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                    View Stars <ChevronRight size={12} />
                                                </span>
                                            )}
                                            {item.type === 'lobby' && (
                                                <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                                                    View Lobbies <ChevronRight size={12} />
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="py-20 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto opacity-50">
                                    <Bell size={32} className="text-slate-400" />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold">All caught up!</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">No notifications here yet.</p>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            {!isPro && showProCard && (
                <div className="fixed bottom-28 left-4 right-4 max-w-xl mx-auto">
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-2xl shadow-xl shadow-purple-500/20 text-white flex items-center justify-between gap-4 relative">
                        <button
                            onClick={() => setShowProCard(false)}
                            className="absolute -top-2 -right-2 w-8 h-8 bg-white dark:bg-[#1a1429] text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center shadow-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <X size={16} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider opacity-80">Pro Feature</p>
                                <p className="text-sm font-bold">See who takes your quizzes</p>
                            </div>
                        </div>
                        <button className="bg-white text-purple-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-purple-50 transition-colors active:scale-95">
                            Upgrade
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
