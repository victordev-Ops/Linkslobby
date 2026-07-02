'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, Plus, Flame, Users, Loader2, Lock, Unlock, X, Sparkles,
    MoreVertical, Trash2, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { useScrollLock } from '@/hooks/useScrollLock'
import { closeHotSeatSession, reopenHotSeatSession, deleteHotSeatSession } from '@/actions/hot-seat'

interface Profile {
    id: string
    username: string
    slug: string
    is_pro?: boolean
}

interface HotSeatSession {
    id: string
    host_id: string
    slug: string
    name: string
    status: string
    is_private: boolean
    is_closed?: boolean
    created_at: string
    host?: { username: string; slug: string }
    hot_seat_participants?: { count: number }[]
}

interface HotSeatListClientProps {
    profile: Profile
    sessions: HotSeatSession[]
}

type ConfirmAction =
    | { type: 'close'; sessionId: string; sessionName: string }
    | { type: 'reopen'; sessionId: string; sessionName: string }
    | { type: 'delete'; sessionId: string; sessionName: string }
    | null

export default function HotSeatListClient({ profile, sessions }: HotSeatListClientProps) {
    const supabase = useMemo(() => createClient(), [])
    const router = useRouter()
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [sessionName, setSessionName] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    // Local copy so close/reopen/delete can update the list instantly
    // instead of waiting on a server round-trip.
    const [localSessions, setLocalSessions] = useState(sessions)
    useEffect(() => { setLocalSessions(sessions) }, [sessions])

    const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
    const [isConfirming, setIsConfirming] = useState(false)

    useScrollLock(showCreateModal || confirmAction !== null)

    // Close the open kebab menu on outside click
    useEffect(() => {
        if (!menuOpenId) return
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpenId(null)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [menuOpenId])

    const runConfirmedAction = async () => {
        if (!confirmAction) return
        setIsConfirming(true)
        try {
            if (confirmAction.type === 'close') {
                const result = await closeHotSeatSession(confirmAction.sessionId)
                if (result.success) {
                    setLocalSessions(prev => prev.map(s => s.id === confirmAction.sessionId ? { ...s, is_closed: true } : s))
                    toast.success('Session closed to new participants')
                } else {
                    toast.error(result.error)
                }
            } else if (confirmAction.type === 'reopen') {
                const result = await reopenHotSeatSession(confirmAction.sessionId)
                if (result.success) {
                    setLocalSessions(prev => prev.map(s => s.id === confirmAction.sessionId ? { ...s, is_closed: false } : s))
                    toast.success('Session reopened')
                } else {
                    toast.error(result.error)
                }
            } else if (confirmAction.type === 'delete') {
                const result = await deleteHotSeatSession(confirmAction.sessionId)
                if (result.success) {
                    setLocalSessions(prev => prev.filter(s => s.id !== confirmAction.sessionId))
                    toast.success('Session deleted')
                } else {
                    toast.error(result.error)
                }
            }
        } finally {
            setIsConfirming(false)
            setConfirmAction(null)
        }
    }

    const confirmCopy: Record<NonNullable<ConfirmAction>['type'], { title: string; body: string; confirmLabel: string; danger?: boolean }> = {
        close: {
            title: 'Close this session?',
            body: 'No new participants will be able to join. Anyone already in the session keeps playing as normal.',
            confirmLabel: 'Close session'
        },
        reopen: {
            title: 'Reopen this session?',
            body: 'New participants will be able to join again using the share link.',
            confirmLabel: 'Reopen session'
        },
        delete: {
            title: 'Delete this session?',
            body: 'This permanently removes the session, its questions, and its participant list. This can\'t be undone.',
            confirmLabel: 'Delete forever',
            danger: true
        }
    }

    const createSession = async () => {
        if (!sessionName.trim()) return
        setIsCreating(true)

        try {
            const slug = `${sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-${Date.now().toString(36)}`

            const { data: session, error } = await supabase
                .from('hot_seat_sessions')
                .insert({
                    host_id: profile.id,
                    slug,
                    name: sessionName.trim(),
                    is_private: true,
                    status: 'waiting'
                })
                .select('id, slug')
                .single()

            if (error) throw error

            // Auto-join as host participant
            await supabase.from('hot_seat_participants').insert({
                session_id: session.id,
                user_id: profile.id,
                status: 'joined'
            })

            router.push(`/hot-seat/${session.slug}`)
        } catch (err) {
            console.error('Error creating session:', err)
        } finally {
            setIsCreating(false)
        }
    }

    const getParticipantCount = (session: HotSeatSession) => {
        if (session.hot_seat_participants && session.hot_seat_participants.length > 0) {
            return session.hot_seat_participants[0].count || 0
        }
        return 0
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-950 via-[#0a0a0f] to-[#0a0a0f] text-white">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-amber-950/80 backdrop-blur-xl border-b border-amber-500/10">
                <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/dashboard')} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition active:scale-95">
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                                <Flame className="w-5 h-5 text-amber-400" />
                                Hot Seat
                            </h1>
                            <p className="text-[10px] text-amber-400/60 font-bold uppercase tracking-widest">Rapid Fire Questions</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
                    >
                        <Plus size={16} />
                        Create
                    </button>
                </div>
            </div>

            {/* Session List */}
            <div className="max-w-xl mx-auto px-4 py-6 pb-24 space-y-3">
                {localSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                            <Flame className="w-10 h-10 text-amber-500/40" />
                        </div>
                        <h3 className="text-lg font-bold text-white/80 mb-1">No active sessions</h3>
                        <p className="text-sm text-white/40 max-w-[250px]">
                            Create a Hot Seat session and share the link with friends to get started!
                        </p>
                    </div>
                ) : (
                    localSessions.map(session => (
                        <div
                            key={session.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/hot-seat/${session.slug}`)}
                            onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/hot-seat/${session.slug}`) }}
                            className="relative w-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 transition-all active:scale-[0.98] text-left cursor-pointer"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
                                <Flame className="w-6 h-6 text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-white truncate">{session.name}</h3>
                                    {session.is_private && <Lock size={12} className="text-amber-400/60 shrink-0" />}
                                    {session.status === 'active' && (
                                        <span className="bg-green-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">Live</span>
                                    )}
                                    {session.is_closed && (
                                        <span className="bg-white/10 text-white/50 text-[8px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">Closed</span>
                                    )}
                                </div>
                                <p className="text-xs text-white/40 mt-0.5">
                                    by @{session.host?.username || 'unknown'}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 text-white/30 shrink-0">
                                <Users size={14} />
                                <span className="text-xs font-bold">{getParticipantCount(session)}</span>
                            </div>

                            {/* Kebab menu — session management, host-only list so no ownership check needed */}
                            <div
                                className="relative shrink-0"
                                ref={menuOpenId === session.id ? menuRef : undefined}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => setMenuOpenId(menuOpenId === session.id ? null : session.id)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition"
                                >
                                    <MoreVertical size={16} />
                                </button>

                                {menuOpenId === session.id && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden backdrop-blur-xl">
                                        <div className="p-1.5 space-y-0.5">
                                            {session.is_closed ? (
                                                <button
                                                    onClick={() => {
                                                        setConfirmAction({ type: 'reopen', sessionId: session.id, sessionName: session.name })
                                                        setMenuOpenId(null)
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition"
                                                >
                                                    <Unlock size={16} /> Reopen Session
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setConfirmAction({ type: 'close', sessionId: session.id, sessionName: session.name })
                                                        setMenuOpenId(null)
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition"
                                                >
                                                    <Lock size={16} /> Close Session
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setConfirmAction({ type: 'delete', sessionId: session.id, sessionName: session.name })
                                                    setMenuOpenId(null)
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition"
                                            >
                                                <Trash2 size={16} /> Delete Session
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Session Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl">
                    <div className="bg-[#0f0a1e] border border-amber-500/10 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[85dvh] flex flex-col animate-in slide-in-from-bottom-4 duration-300 pb-[env(safe-area-inset-bottom)] sm:pb-0">
                        {/* Drag Handle for Mobile */}
                        <div className="flex justify-center pt-3 sm:hidden shrink-0">
                            <div className="w-12 h-1.5 bg-white/10 rounded-full" />
                        </div>

                        <div className="p-5 sm:p-6 border-b border-amber-500/10 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                    <Flame className="w-5 h-5 text-amber-400" />
                                    New Hot Seat
                                </h3>
                                <p className="text-amber-400/40 text-[10px] font-bold uppercase tracking-widest mt-1">You'll be in the hot seat</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition active:scale-90">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 ml-1">Session Name</label>
                                <input
                                    value={sessionName}
                                    onChange={(e) => setSessionName(e.target.value)}
                                    placeholder="e.g. Friday Night Hot Seat"
                                    maxLength={50}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-amber-500/30 transition"
                                />
                            </div>

                            <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                                <p className="text-[11px] text-amber-300/60 leading-relaxed font-medium">
                                    You sit in the hot seat. Friends fire rapid questions at you. Answer within <strong className="text-amber-300">30 seconds</strong> or lose <strong className="text-amber-300">10 ⭐</strong>!
                                </p>
                            </div>
                        </div>

                        <div className="p-5 sm:p-6 border-t border-amber-500/10 shrink-0">
                            <button
                                onClick={createSession}
                                disabled={isCreating || !sessionName.trim()}
                                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                {isCreating ? 'Creating...' : 'Start Hot Seat'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog: close / reopen / delete */}
            {confirmAction && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div
                        onClick={() => !isConfirming && setConfirmAction(null)}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <div className="relative w-full max-w-sm bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl p-6">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-4 ${confirmCopy[confirmAction.type].danger ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                            <AlertTriangle size={20} className={confirmCopy[confirmAction.type].danger ? 'text-red-400' : 'text-amber-500'} />
                        </div>
                        <h3 className="font-bold text-lg text-white mb-1.5">{confirmCopy[confirmAction.type].title}</h3>
                        <p className="text-sm text-white/50 leading-relaxed mb-1">{confirmCopy[confirmAction.type].body}</p>
                        <p className="text-xs text-white/30 mb-6 truncate">"{confirmAction.sessionName}"</p>
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
                    </div>
                </div>
            )}
        </div>
    )
}
