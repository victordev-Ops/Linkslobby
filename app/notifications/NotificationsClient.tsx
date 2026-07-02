"use client"

import { useState, useEffect, useRef } from "react"
import {
    Bell, MessageSquare, Brain, Users, Lock,
    ArrowLeft, ChevronRight, ChevronDown, Trophy, TrendingUp, TrendingDown,
    Eye, EyeOff, Loader2, X, Trash2, Flame, BadgeCheck, Ban,
    CheckCircle2, Circle, XCircle, Dices
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { formatDistanceToNow } from "@/lib/utils"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { markConfessionAsRead } from "@/actions/confessions"
import { hideNotification, markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notifications"
import { revealDYKMRespondent } from "@/actions/reveal"
import { useRouter } from "next/navigation"
import { db } from '@/lib/db'
import { queueOfflineAction } from '@/lib/sync'
import { useNotifications } from "@/context/NotificationContext"
import VerifiedBadge from "@/components/VerifiedBadge"

interface NotificationsClientProps {
    initialConfessions: any[]
    initialDykmScores: any[]
    initialLobbyEvents: any[]
    initialXpTransactions: any[]
    initialHotSeatQuestions: any[]
    initialTurnEvents: any[]
    initialFriendRequests: any[]
    initialFriendResponses: any[]
    initialLobbyJoinResponses: any[]
    initialHotSeatAnswers: any[]
    initialGameInvites: any[]
    initialReadIds: string[] // pre-computed "${notification_type}:${notification_id}" keys, from server
    isPro: boolean
    username: string
    profileId: string
}

type Tab = "All" | "Messages" | "Games" | "Lobbies" | "XP" | "Hot Seat" | "Friends"

function stripMetadata(message: string): string {
    return message.replace(/\n\n\[META:.*\]$/s, '').trim()
}

// Game invites live in their own game_invites table (inviter_id, invitee_id,
// game_type, game_label, game_url, is_read). The invite URL is stored as an
// absolute URL (window.location.href at send time) — route with the path only
// so navigation stays within the app / current origin.
function getInvitePath(gameUrl: string): string {
    try {
        const u = new URL(gameUrl)
        return `${u.pathname}${u.search}`
    } catch {
        return gameUrl
    }
}

export default function NotificationsClient({
    initialConfessions,
    initialDykmScores,
    initialLobbyEvents,
    initialXpTransactions,
    initialHotSeatQuestions,
    initialTurnEvents,
    initialFriendRequests,
    initialFriendResponses,
    initialLobbyJoinResponses,
    initialHotSeatAnswers,
    initialGameInvites,
    initialReadIds,
    isPro,
    username,
    profileId
}: NotificationsClientProps) {
    const { refreshUnreadCount, setUnreadCount } = useNotifications()
    const [confessions, setConfessions] = useState(initialConfessions)
    const [dykmScores, setDykmScores] = useState(initialDykmScores)
    const [lobbyEvents, setLobbyEvents] = useState(initialLobbyEvents)
    const [xpTransactions, setXpTransactions] = useState(initialXpTransactions)
    const [hotSeatQuestions, setHotSeatQuestions] = useState(initialHotSeatQuestions)
    const [turnEvents, setTurnEvents] = useState(initialTurnEvents)
    const [friendRequests, setFriendRequests] = useState(initialFriendRequests)
    const [friendResponses, setFriendResponses] = useState(initialFriendResponses)
    const [lobbyJoinResponses, setLobbyJoinResponses] = useState(initialLobbyJoinResponses)
    const [hotSeatAnswers, setHotSeatAnswers] = useState(initialHotSeatAnswers)
    const [gameInvites, setGameInvites] = useState(initialGameInvites)
    const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set(initialReadIds))
    const [activeTab, setActiveTab] = useState<Tab>("All")
    // Pre-populate revealed state from server data
    const [revealedScores, setRevealedScores] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {}
        initialDykmScores.forEach((s: any) => {
            if (s.responder_revealed) initial[s.id] = true
        })
        return initial
    })
    const [isRevealing, setIsRevealing] = useState<string | null>(null)
    const [showProCard, setShowProCard] = useState(true)
    const [hotSeatSessionIds, setHotSeatSessionIds] = useState<string[]>([])
    const [selectionMode, setSelectionMode] = useState(false)
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longPressTriggered = useRef(false)
    const filterRef = useRef<HTMLDivElement | null>(null)
    const supabase = createClient()
    const router = useRouter()

    // Close the tab filter dropdown on outside click
    useEffect(() => {
        if (!isFilterOpen) return
        const handleClickOutside = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setIsFilterOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [isFilterOpen])

    // Cache all initial data in Dexie on mount for offline access
    useEffect(() => {
        const now = Date.now()

        const syncDexie = async () => {
            // 1. Mark existing cached notifications as hidden if they aren't in the server props
            const allInitialIds = new Set([
                ...initialConfessions.map(c => c.id),
                ...initialDykmScores.map(s => s.id),
                ...initialLobbyEvents.map(e => e.id),
                ...initialXpTransactions.map(x => x.id),
                ...initialHotSeatQuestions.map(q => q.id),
                ...initialTurnEvents.map(t => t.id),
                ...initialFriendRequests.map(f => f.id),
                ...initialFriendResponses.map(f => f.id),
                ...initialLobbyJoinResponses.map(p => p.id),
                ...initialHotSeatAnswers.map(q => q.id),
                ...initialGameInvites.map(i => i.id),
            ])

            try {
                const cachedVisible = await db.notifications.where('is_hidden').equals(0).toArray()
                const toHide = cachedVisible.filter(c => !allInitialIds.has(c.id)).map(c => c.id)

                if (toHide.length > 0) {
                    console.log('Syncing Dexie: Marking as hidden:', toHide)
                    await db.notifications.bulkUpdate(toHide.map(id => ({ key: id, changes: { is_hidden: true } })))
                }
            } catch (err) {
                console.error('Dexie sync failed:', err)
            }

            // 2. Cache/Update fresh data
            if (initialConfessions.length > 0) {
                db.confessions.bulkPut(
                    initialConfessions.map((c: any) => ({ ...c, cached_at: now }))
                ).catch(() => { })
            }
            if (initialXpTransactions.length > 0) {
                db.xpTransactions.bulkPut(
                    initialXpTransactions.map((x: any) => ({ ...x, cached_at: now }))
                ).catch(() => { })
            }
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
        }

        syncDexie()
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
                refreshUnreadCount()
            })
            // XP Transactions
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'xp_transactions',
                filter: `user_id=eq.${profileId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setXpTransactions(prev => [payload.new, ...prev])
                } else if (payload.eventType === 'UPDATE') {
                    setXpTransactions(prev => prev.map(x => x.id === payload.new.id ? payload.new : x))
                }
                refreshUnreadCount()
            })
            // Hot Seat Questions (host view — new question + asker view — answer resolved)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'hot_seat_questions'
            }, async (payload) => {
                const q = payload.new
                // New question we host
                if (payload.eventType === 'INSERT' && hotSeatSessionIds.includes(q.session_id)) {
                    const { data } = await supabase
                        .from('hot_seat_questions')
                        .select('*, session:hot_seat_sessions(name, slug)')
                        .eq('id', q.id)
                        .single()
                    if (data) setHotSeatQuestions(prev => [data, ...prev])
                }
                // My question got resolved
                if (
                    payload.eventType === 'UPDATE' &&
                    q.asker_id === profileId &&
                    ['answered', 'skipped', 'timed_out'].includes(q.status)
                ) {
                    const { data } = await supabase
                        .from('hot_seat_questions')
                        .select('*, session:hot_seat_sessions(name, slug)')
                        .eq('id', q.id)
                        .single()
                    if (data) {
                        setHotSeatAnswers(prev =>
                            prev.some(a => a.id === data.id) ? prev.map(a => a.id === data.id ? data : a) : [data, ...prev]
                        )
                    }
                }
                refreshUnreadCount()
            })
            // Lobby turn events
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'tod_turn_events',
                filter: `user_id=eq.${profileId}`
            }, async (payload) => {
                const { data } = await supabase
                    .from('tod_turn_events')
                    .select('*, lobby:tod_lobbies(name, slug)')
                    .eq('id', payload.new.id)
                    .single()
                if (data) setTurnEvents(prev => [data, ...prev])
                refreshUnreadCount()
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tod_turn_events',
                filter: `user_id=eq.${profileId}`
            }, (payload) => {
                setTurnEvents(prev => prev.map(t => t.id === payload.new.id ? payload.new : t))
                refreshUnreadCount()
            })
            // Lobby join responses (rejected/banned)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tod_participants',
                filter: `user_id=eq.${profileId}`
            }, async (payload) => {
                if (!['rejected', 'banned'].includes(payload.new.status)) return
                const { data } = await supabase
                    .from('tod_participants')
                    .select('*, lobby:tod_lobbies(name, slug)')
                    .eq('id', payload.new.id)
                    .single()
                if (data) {
                    setLobbyJoinResponses(prev =>
                        prev.some(p => p.id === data.id) ? prev.map(p => p.id === data.id ? data : p) : [data, ...prev]
                    )
                }
                refreshUnreadCount()
            })
            // Friend requests (incoming)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friendships',
                filter: `addressee_id=eq.${profileId}`
            }, async (payload) => {
                if (payload.eventType === 'DELETE') {
                    setFriendRequests(prev => prev.filter(f => f.id !== payload.old.id))
                    return
                }
                if (payload.new.status !== 'pending') {
                    setFriendRequests(prev => prev.filter(f => f.id !== payload.new.id))
                    refreshUnreadCount()
                    return
                }
                const { data } = await supabase
                    .from('friendships')
                    .select('*, profile:profiles!friendships_requester_id_fkey(username, slug, avatar_url)')
                    .eq('id', payload.new.id)
                    .single()
                if (data) {
                    setFriendRequests(prev =>
                        prev.some(f => f.id === data.id) ? prev.map(f => f.id === data.id ? data : f) : [data, ...prev]
                    )
                }
                refreshUnreadCount()
            })
            // Friend request responses (I'm requester, accepted)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'friendships',
                filter: `requester_id=eq.${profileId}`
            }, async (payload) => {
                if (payload.new.status !== 'accepted') return
                const { data } = await supabase
                    .from('friendships')
                    .select('*, profile:profiles!friendships_addressee_id_fkey(username, slug, avatar_url)')
                    .eq('id', payload.new.id)
                    .single()
                if (data) {
                    setFriendResponses(prev => prev.some(f => f.id === data.id) ? prev : [data, ...prev])
                }
                refreshUnreadCount()
            })
            // Game invites (dedicated table)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'game_invites',
                filter: `invitee_id=eq.${profileId}`
            }, async (payload) => {
                if (payload.eventType === 'DELETE') {
                    setGameInvites(prev => prev.filter(i => i.id !== payload.old.id))
                    return
                }
                const { data } = await supabase
                    .from('game_invites')
                    .select('*, inviter:profiles!game_invites_inviter_id_fkey(username, slug, avatar_url)')
                    .eq('id', payload.new.id)
                    .single()
                if (data) {
                    setGameInvites(prev =>
                        prev.some(i => i.id === data.id) ? prev.map(i => i.id === data.id ? data : i) : [data, ...prev]
                    )
                }
                refreshUnreadCount()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [profileId, supabase, hotSeatSessionIds, refreshUnreadCount])

    const handleSelectMessage = async (item: any) => {
        // Mark as read if unread
        if (!item.is_read) {
            // Optimistic UI update
            if (item.type === 'message') setConfessions(prev => prev.map(c => c.id === item.id ? { ...c, is_read: true } : c))
            else if (item.type === 'dykm') setDykmScores(prev => prev.map(s => s.id === item.id ? { ...s, is_read: true } : s))
            else if (item.type === 'xp') setXpTransactions(prev => prev.map(x => x.id === item.id ? { ...x, is_read: true } : x))
            else if (item.type === 'hot_seat') setHotSeatQuestions(prev => prev.map(q => q.id === item.id ? { ...q, is_read: true } : q))
            else if (item.type === 'lobby') setLobbyEvents(prev => prev.map(l => l.id === item.id ? { ...l, is_read: true } : l))
            else if (item.type === 'tod_turn') setTurnEvents(prev => prev.map(t => t.id === item.id ? { ...t, is_read: true } : t))
            else if (item.type === 'game_invite') setGameInvites(prev => prev.map(i => i.id === item.id ? { ...i, is_read: true } : i))
            else {
                // notification_reads-backed types: track read state in the Set
                setReadNotificationIds(prev => new Set(prev).add(`${item.type}:${item.id}`))
            }

            await markNotificationAsRead(item.id, item.type as any)
            await refreshUnreadCount()
        }

        if (item.type === 'message') {
            if (item.is_dm) {
                const match = item.message.match(/^\[DM:[a-f0-9-]+:?([^\]]*)\]/)
                const senderUsername = match ? match[1] : null
                if (senderUsername) {
                    router.push(`/messages/${senderUsername}`)
                } else {
                    router.push(`/inbox/${item.id}`)
                }
            } else {
                router.push(`/inbox/${item.id}`)
            }
        } else if (item.type === 'hot_seat') {
            router.push(`/hot-seat/${item.session?.slug || ''}`)
        } else if (item.type === 'game_invite') {
            router.push(getInvitePath(item.game_url))
        } else if (item.type === 'xp') {
            router.push('/stars')
        } else if (item.type === 'lobby') {
            router.push('/tod')
        } else if (item.type === 'dykm') {
            router.push(`/dykm/results/${item.id}`)
        } else if (item.type === 'tod_turn' || item.type === 'lobby_join_response') {
            router.push(`/tod/${item.lobby?.slug || ''}`)
        } else if (item.type === 'friend_request' || item.type === 'friend_request_response') {
            router.push(item.profile?.slug ? `/u/${item.profile.slug}` : '/notifications')
        } else if (item.type === 'hot_seat_answer') {
            router.push(`/hot-seat/${item.session?.slug || ''}`)
        }
    }

    const handleMarkAllRead = async () => {
        // Optimistic UI update
        setConfessions(prev => prev.map(c => ({ ...c, is_read: true })))
        setDykmScores(prev => prev.map(s => ({ ...s, is_read: true })))
        setXpTransactions(prev => prev.map(x => ({ ...x, is_read: true })))
        setHotSeatQuestions(prev => prev.map(q => ({ ...q, is_read: true })))
        setLobbyEvents(prev => prev.map(l => ({ ...l, is_read: true })))
        setTurnEvents(prev => prev.map(t => ({ ...t, is_read: true })))
        setGameInvites(prev => prev.map(i => ({ ...i, is_read: true })))
        setReadNotificationIds(prev => {
            const next = new Set(prev)
            friendRequests.forEach(f => next.add(`friend_request:${f.id}`))
            friendResponses.forEach(f => next.add(`friend_request_response:${f.id}`))
            lobbyJoinResponses.forEach(p => next.add(`lobby_join_response:${p.id}`))
            hotSeatAnswers.forEach(q => next.add(`hot_seat_answer:${q.id}`))
            return next
        })
        setUnreadCount(0)

        const result = await markAllNotificationsAsRead()
        if (result.success) {
            toast.success("All notifications marked as read")
            await refreshUnreadCount()
        } else {
            toast.error("Failed to mark all as read")
        }
    }

    const handleHide = async (e: React.MouseEvent, item: any) => {
        e.stopPropagation()
        console.log('handleHide triggered for:', { id: item.id, type: item.type })

        // Optimistic update
        const originalConfessions = [...confessions]
        const originalDykmScores = [...dykmScores]
        const originalLobbyEvents = [...lobbyEvents]
        const originalXp = [...xpTransactions]
        const originalHotSeat = [...hotSeatQuestions]
        const originalTurnEvents = [...turnEvents]
        const originalGameInvites = [...gameInvites]

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
        } else if (item.type === 'tod_turn') {
            setTurnEvents(prev => prev.filter(t => t.id !== item.id))
        } else if (item.type === 'game_invite') {
            setGameInvites(prev => prev.filter(i => i.id !== item.id))
        }
        // Note: friend_request / friend_request_response / lobby_join_response / hot_seat_answer
        // are not hideable — they're not in hidden_notifications' CHECK constraint, and conceptually
        // they resolve themselves (request gets answered, status changes) rather than needing a
        // manual dismiss. Hide button is conditionally hidden for these types below.

        if (db?.notifications) {
            db.notifications.update(item.id, { is_hidden: true }).catch(() => { })
        }

        try {
            const result = await hideNotification(item.id, item.type as any)
            if (result.success) {
                refreshUnreadCount().catch(console.error)
            } else {
                console.error('Server hide failed:', result)
                if (item.type === 'message') setConfessions(originalConfessions)
                else if (item.type === 'dykm') setDykmScores(originalDykmScores)
                else if (item.type === 'lobby') setLobbyEvents(originalLobbyEvents)
                else if (item.type === 'xp') setXpTransactions(originalXp)
                else if (item.type === 'hot_seat') setHotSeatQuestions(originalHotSeat)
                else if (item.type === 'tod_turn') setTurnEvents(originalTurnEvents)
                else if (item.type === 'game_invite') setGameInvites(originalGameInvites)

                db.notifications.update(item.id, { is_hidden: false }).catch(() => { })
                toast.error("Failed to hide notification")
            }
        } catch {
            toast.error("Failed to hide notification")
        }
    }

    const itemKey = (item: any) => `${item.type}-${item.id}`

    const handlePressStart = (item: any) => {
        longPressTriggered.current = false
        longPressTimer.current = setTimeout(() => {
            longPressTriggered.current = true
            setSelectionMode(true)
            setSelectedItems(prev => new Set(prev).add(itemKey(item)))
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
        }, 500)
    }

    const handlePressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }

    const toggleSelectItem = (item: any) => {
        const key = itemKey(item)
        setSelectedItems(prev => {
            const next = new Set(prev)
            if (next.has(key)) {
                next.delete(key)
            } else {
                next.add(key)
            }
            if (next.size === 0) setSelectionMode(false)
            return next
        })
    }

    const handleCancelSelection = () => {
        setSelectionMode(false)
        setSelectedItems(new Set())
    }

    const handleSelectAll = () => {
        setSelectedItems(new Set(filteredNotifications.map(itemKey)))
    }

    const handleBatchMarkRead = async () => {
        const itemsToMark = allNotifications.filter(n => selectedItems.has(itemKey(n)) && !n.is_read)
        if (itemsToMark.length === 0) {
            handleCancelSelection()
            return
        }

        // Optimistic updates
        setConfessions(prev => prev.map(c => selectedItems.has(`message-${c.id}`) ? { ...c, is_read: true } : c))
        setDykmScores(prev => prev.map(s => selectedItems.has(`dykm-${s.id}`) ? { ...s, is_read: true } : s))
        setXpTransactions(prev => prev.map(x => selectedItems.has(`xp-${x.id}`) ? { ...x, is_read: true } : x))
        setHotSeatQuestions(prev => prev.map(q => selectedItems.has(`hot_seat-${q.id}`) ? { ...q, is_read: true } : q))
        setLobbyEvents(prev => prev.map(l => selectedItems.has(`lobby-${l.id}`) ? { ...l, is_read: true } : l))
        setTurnEvents(prev => prev.map(t => selectedItems.has(`tod_turn-${t.id}`) ? { ...t, is_read: true } : t))
        setGameInvites(prev => prev.map(i => selectedItems.has(`game_invite-${i.id}`) ? { ...i, is_read: true } : i))
        setReadNotificationIds(prev => {
            const next = new Set(prev)
            itemsToMark.forEach(item => {
                if (['friend_request', 'friend_request_response', 'lobby_join_response', 'hot_seat_answer'].includes(item.type)) {
                    next.add(`${item.type}:${item.id}`)
                }
            })
            return next
        })

        const count = itemsToMark.length
        handleCancelSelection()

        try {
            await Promise.all(itemsToMark.map(item => markNotificationAsRead(item.id, item.type as any)))
            await refreshUnreadCount()
            toast.success(`Marked ${count} notification${count > 1 ? 's' : ''} as read`)
        } catch {
            toast.error("Failed to mark notifications as read")
        }
    }

    const handleBatchDelete = async () => {
        const itemsToDelete = allNotifications.filter(n => selectedItems.has(itemKey(n)) && isHideable(n.type))
        if (itemsToDelete.length === 0) {
            handleCancelSelection()
            return
        }

        // Optimistic updates
        setConfessions(prev => prev.filter(c => !selectedItems.has(`message-${c.id}`)))
        setDykmScores(prev => prev.filter(s => !selectedItems.has(`dykm-${s.id}`)))
        setLobbyEvents(prev => prev.filter(l => !selectedItems.has(`lobby-${l.id}`)))
        setXpTransactions(prev => prev.filter(x => !selectedItems.has(`xp-${x.id}`)))
        setHotSeatQuestions(prev => prev.filter(q => !selectedItems.has(`hot_seat-${q.id}`)))
        setTurnEvents(prev => prev.filter(t => !selectedItems.has(`tod_turn-${t.id}`)))
        setGameInvites(prev => prev.filter(i => !selectedItems.has(`game_invite-${i.id}`)))

        if (db?.notifications) {
            itemsToDelete.forEach(item => {
                db.notifications.update(item.id, { is_hidden: true }).catch(() => { })
            })
        }

        const count = itemsToDelete.length
        handleCancelSelection()

        try {
            const results = await Promise.all(itemsToDelete.map(item => hideNotification(item.id, item.type as any)))
            const failedCount = results.filter(r => !r.success).length
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} notification${failedCount > 1 ? 's' : ''}`)
            } else {
                toast.success(`Deleted ${count} notification${count > 1 ? 's' : ''}`)
            }
            refreshUnreadCount().catch(console.error)
        } catch {
            toast.error("Failed to delete notifications")
        }
    }

    // Game invites come from their own table now — map them straight into item
    // shape (still tagged isInvite/inviteMeta so the render/handler code below
    // that keys off those fields doesn't need to change).
    const gameInviteItems = gameInvites.map(inv => ({
        ...inv,
        type: 'game_invite' as const,
        isInvite: true,
        inviteMeta: {
            gameType: inv.game_type as 'tod' | 'hot_seat',
            gameLabel: inv.game_label || (inv.game_type === 'tod' ? 'Truth or Dare' : 'Hot Seat'),
            inviterUsername: inv.inviter?.username || 'Someone',
            gameUrl: inv.game_url,
        },
        category: inv.game_type === 'tod' ? 'Lobbies' : 'Hot Seat',
    }))

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
        ...xpTransactions.map(x => ({ ...x, xpType: x.type, type: 'xp', category: 'XP' })),
        ...gameInviteItems,
        ...hotSeatQuestions.map(q => ({ ...q, type: 'hot_seat', category: 'Hot Seat' })),
        ...turnEvents.map(t => ({ ...t, type: 'tod_turn', category: 'Lobbies' })),
        ...friendRequests.map(f => ({
            ...f,
            type: 'friend_request',
            category: 'Friends',
            is_read: readNotificationIds.has(`friend_request:${f.id}`)
        })),
        ...friendResponses.map(f => ({
            ...f,
            type: 'friend_request_response',
            category: 'Friends',
            is_read: readNotificationIds.has(`friend_request_response:${f.id}`)
        })),
        ...lobbyJoinResponses.map(p => ({
            ...p,
            type: 'lobby_join_response',
            category: 'Lobbies',
            is_read: readNotificationIds.has(`lobby_join_response:${p.id}`)
        })),
        ...hotSeatAnswers.map(q => ({
            ...q,
            type: 'hot_seat_answer',
            category: 'Hot Seat',
            is_read: readNotificationIds.has(`hot_seat_answer:${q.id}`)
        })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const filteredNotifications = allNotifications.filter(n =>
        activeTab === "All" || n.category === activeTab
    )

    const handleJoinInvite = (e: React.MouseEvent, item: any) => {
        e.stopPropagation()
        if (!item.is_read) {
            setGameInvites(prev => prev.map(i => i.id === item.id ? { ...i, is_read: true } : i))
            markNotificationAsRead(item.id, 'game_invite').catch(() => { })
            refreshUnreadCount().catch(() => { })
        }
        router.push(getInvitePath(item.inviteMeta.gameUrl))
    }

    const handleReveal = async (scoreId: string) => {
        setIsRevealing(scoreId)
        try {
            const result = await revealDYKMRespondent(scoreId)
            if (result.success) {
                setRevealedScores(prev => ({ ...prev, [scoreId]: true }))
                toast.success("Identity revealed!")
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
                return item.xpType === 'earn'
                    ? <TrendingUp className="text-green-600 dark:text-green-400" size={18} />
                    : <TrendingDown className="text-red-600 dark:text-red-400" size={18} />
            case 'game_invite':
                return item.inviteMeta.gameType === 'tod'
                    ? <Dices className="text-indigo-500" size={18} />
                    : <Flame className="text-amber-500" size={18} />
            case 'hot_seat':
                return <Flame className="text-red-500" size={18} />
            case 'tod_turn':
                return <Users className="text-green-500" size={18} />
            case 'lobby_join_response':
                return item.status === 'banned'
                    ? <Ban className="text-red-500" size={18} />
                    : <X className="text-orange-500" size={18} />
            case 'friend_request':
                return <Users className="text-blue-500" size={18} />
            case 'friend_request_response':
                return <Users className="text-emerald-500" size={18} />
            case 'hot_seat_answer':
                return <Flame className="text-orange-500" size={18} />
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
            case 'lobby': {
                const lobbyName = item.tod_lobbies?.name ? ` in ${item.tod_lobbies.name}` : ''
                const content = (item.content || '').toLowerCase()
                if (content.includes('joined')) return `🎉 Someone joined${lobbyName}`
                if (content.includes('your turn') && content.includes('target')) return `🎯 It's your turn as target${lobbyName}!`
                if (content.includes('your turn') && content.includes('ask')) return `🎲 It's your turn to ask${lobbyName}!`
                if (content.includes('your turn')) return `🎯 It's your turn${lobbyName}!`
                return item.content + (lobbyName ? ` ${lobbyName}` : '')
            }
            case 'xp': {
                const sign = item.xpType === 'earn' ? '+' : '-'
                return `${sign}${Math.abs(item.amount)} Stars — ${item.reason}`
            }
            case 'game_invite':
                return item.inviteMeta.gameType === 'tod'
                    ? `🎲 @${item.inviteMeta.inviterUsername} invited you to play Truth or Dare`
                    : `🔥 @${item.inviteMeta.inviterUsername} invited you to Hot Seat`
            case 'hot_seat':
                return `Hot Seat: New Question! 🔥`
            case 'tod_turn': {
                const lobbyName = item.lobby?.name ? ` in ${item.lobby.name}` : ''
                return item.role === 'target'
                    ? `🎯 It's your turn as target${lobbyName}!`
                    : `🎲 It's your turn to ask${lobbyName}!`
            }
            case 'lobby_join_response':
                return item.status === 'banned'
                    ? `🚫 Banned from ${item.lobby?.name || 'a lobby'}`
                    : `Request to join ${item.lobby?.name || 'a lobby'} declined`
            case 'friend_request':
                return `👋 @${item.profile?.username || 'Someone'} sent you a friend request`
            case 'friend_request_response':
                return `🤝 @${item.profile?.username || 'Someone'} accepted your friend request`
            case 'hot_seat_answer': {
                const labels: Record<string, string> = { answered: 'answered', skipped: 'skipped', timed_out: 'timed out' }
                return `🔥 Your question was ${labels[item.status] || 'resolved'}`
            }
            default:
                return "Notification"
        }
    }

    const isHideable = (type: string) =>
        !['friend_request', 'friend_request_response', 'lobby_join_response', 'hot_seat_answer'].includes(type)

    return (
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24">
            {/* Header */}
            <div className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30 px-4 py-4 flex items-center gap-4">
                {selectionMode ? (
                    <>
                        <button
                            onClick={handleCancelSelection}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"
                        >
                            <XCircle size={20} className="text-slate-600 dark:text-slate-300" />
                        </button>
                        <h1 className="text-sm font-bold text-slate-900 dark:text-white flex-1">
                            {selectedItems.size} selected
                        </h1>
                        <button
                            onClick={handleSelectAll}
                            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 px-3 py-2 rounded-xl transition-colors"
                        >
                            Select all
                        </button>
                    </>
                ) : (
                    <>
                        <Link href="/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                        </Link>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex-1">Notifications</h1>

                        <div className="relative" ref={filterRef}>
                            <button
                                onClick={() => setIsFilterOpen(prev => !prev)}
                                className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-3 py-2 rounded-xl transition-colors"
                            >
                                {activeTab}
                                <ChevronDown size={14} className={`transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
                            </button>
                            <AnimatePresence>
                                {isFilterOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 mt-2 w-40 bg-white dark:bg-[#1a1429] rounded-xl border border-slate-200 dark:border-white/10 shadow-xl z-50 overflow-hidden py-1"
                                    >
                                        {(["All", "Messages", "Games", "Lobbies", "XP", "Hot Seat", "Friends"] as Tab[]).map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => { setActiveTab(tab); setIsFilterOpen(false) }}
                                                className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${activeTab === tab
                                                    ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                                                    }`}
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button
                            onClick={handleMarkAllRead}
                            title="Mark all as read"
                            className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-xl transition-colors"
                        >
                            <CheckCircle2 size={18} />
                        </button>
                    </>
                )}
            </div>

            <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
                {/* Notifications List */}
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {filteredNotifications.length > 0 ? (
                            filteredNotifications.map((item) => (
                                <motion.div
                                    key={`${item.type}-${item.id}`}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    onClick={() => {
                                        if (longPressTriggered.current) {
                                            longPressTriggered.current = false
                                            return
                                        }
                                        if (selectionMode) {
                                            toggleSelectItem(item)
                                        } else {
                                            handleSelectMessage(item)
                                        }
                                    }}
                                    onMouseDown={() => handlePressStart(item)}
                                    onMouseUp={handlePressEnd}
                                    onMouseLeave={handlePressEnd}
                                    onTouchStart={() => handlePressStart(item)}
                                    onTouchEnd={handlePressEnd}
                                    className={`relative p-4 rounded-2xl shadow-sm group transition-all cursor-pointer active:scale-[0.98] border select-none ${item.is_read
                                        ? "bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-md border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30"
                                        : "bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-500/30 hover:border-purple-400"
                                        } ${item.type === 'dykm' && item.is_read ? "bg-blue-50/30 dark:bg-blue-900/5 border-blue-100 dark:border-blue-500/10" : ""} ${selectedItems.has(itemKey(item)) ? "ring-2 ring-purple-500 border-purple-500" : ""}`}
                                >
                                    {selectionMode ? (
                                        <div className="absolute top-4 left-2 z-10">
                                            {selectedItems.has(itemKey(item)) ? (
                                                <CheckCircle2 size={18} className="text-purple-600 dark:text-purple-400" />
                                            ) : (
                                                <Circle size={18} className="text-slate-300 dark:text-slate-600" />
                                            )}
                                        </div>
                                    ) : !item.is_read && (
                                        <div className="absolute top-4 left-2 w-1.5 h-1.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
                                    )}
                                    {isHideable(item.type) && !selectionMode && (
                                        <button
                                            onClick={(e) => handleHide(e, item)}
                                            className="absolute top-2 right-2 p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 z-10"
                                            title="Hide notification"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}

                                    <div className="flex gap-4 pr-6">
                                        <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border ${item.type === 'dykm'
                                            ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30'
                                            : item.type === 'game_invite'
                                                ? item.inviteMeta.gameType === 'tod'
                                                    ? 'bg-indigo-500/10 border-slate-100 dark:border-white/5'
                                                    : 'bg-amber-500/10 border-slate-100 dark:border-white/5'
                                                : item.type === 'xp'
                                                    ? item.xpType === 'earn'
                                                        ? 'bg-green-100/50 dark:bg-green-500/20 border-slate-100 dark:border-white/5'
                                                        : 'bg-red-100/50 dark:bg-red-500/20 border-slate-100 dark:border-white/5'
                                                    : ['hot_seat', 'hot_seat_answer'].includes(item.type) ? 'bg-amber-500/10 border-slate-100 dark:border-white/5' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5'
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
                                                    {item.is_dm ? "Click to view private message" : item.message_type === 'ama' ? `"${stripMetadata(item.message)}"` : "Click to view message"}
                                                </p>
                                            )}

                                            {item.type === 'hot_seat' && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    In session: <span className="text-amber-500 font-bold">{item.session?.name}</span>
                                                </p>
                                            )}

                                            {item.type === 'hot_seat_answer' && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    In session: <span className="text-amber-500 font-bold">{item.session?.name}</span>
                                                </p>
                                            )}

                                            {item.type === 'game_invite' && (
                                                <>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        {item.inviteMeta.gameType === 'tod' ? '🎲' : '🔥'} Play "{item.inviteMeta.gameLabel}"
                                                    </p>
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => handleJoinInvite(e, item)}
                                                            className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white px-3 py-2 rounded-xl transition-all active:scale-95 shadow-sm ${item.inviteMeta.gameType === 'tod'
                                                                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200/50'
                                                                : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200/50'
                                                                }`}
                                                        >
                                                            {item.inviteMeta.gameType === 'tod' ? <Dices size={13} /> : <Flame size={13} />}
                                                            Join Now
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleHide(e, item)}
                                                            className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                </>
                                            )}

                                            {item.type === 'dykm' && (
                                                <div className="mt-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold uppercase tracking-wider">
                                                            Do You Know Me?
                                                        </div>
                                                        {revealedScores[item.id] && (
                                                            <div className="px-2 py-0.5 bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded text-[10px] font-bold">
                                                                @{item.responder_name}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {!revealedScores[item.id] && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleReveal(item.id); }}
                                                            disabled={isRevealing === item.id}
                                                            className={`text-[10px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${isPro
                                                                ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm shadow-blue-200/50"
                                                                : "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                                                                }`}
                                                        >
                                                            {isRevealing === item.id ? (
                                                                <Loader2 size={12} className="animate-spin" />
                                                            ) : isPro ? (
                                                                <><Eye size={12} /> Reveal Identity</>
                                                            ) : (
                                                                <><Lock size={12} /> Reveal (5 ★)</>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {(item.type === 'message' || item.type === 'hot_seat' || item.type === 'hot_seat_answer') && (
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
                                            {(item.type === 'lobby' || item.type === 'tod_turn' || item.type === 'lobby_join_response') && (
                                                <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                                                    View Lobbies <ChevronRight size={12} />
                                                </span>
                                            )}
                                            {(item.type === 'friend_request' || item.type === 'friend_request_response') && (
                                                <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                    View Profile <ChevronRight size={12} />
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

            {selectionMode && (
                <div className="fixed bottom-24 left-4 right-4 max-w-xl mx-auto z-40">
                    <div className="bg-white dark:bg-[#1a1429] p-3 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 pl-2">
                            {selectedItems.size} selected
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleBatchMarkRead}
                                disabled={selectedItems.size === 0}
                                className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 px-3 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <CheckCircle2 size={14} /> Mark read
                            </button>
                            <button
                                onClick={handleBatchDelete}
                                disabled={selectedItems.size === 0}
                                className="flex items-center gap-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!isPro && showProCard && !selectionMode && (
                <div className="fixed bottom-28 left-4 right-4 max-w-xl mx-auto">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-xl shadow-blue-500/20 text-white flex items-center justify-between gap-4 relative">
                        <button
                            onClick={() => setShowProCard(false)}
                            className="absolute -top-2 -right-2 w-8 h-8 bg-white dark:bg-[#1a1429] text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center shadow-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <X size={16} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <BadgeCheck size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider opacity-80">Get Verified</p>
                                <p className="text-sm font-bold">Unlock the blue tick & more</p>
                            </div>
                        </div>
                        <Link href="/upgrade" className="bg-white text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-50 transition-colors active:scale-95">
                            Verify
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
                                              }
                
