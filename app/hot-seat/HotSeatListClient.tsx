'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Flame, Users, Loader2, Lock, X, Sparkles } from 'lucide-react'
import { useScrollLock } from '@/hooks/useScrollLock'

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
    created_at: string
    host?: { username: string; slug: string }
    hot_seat_participants?: { count: number }[]
}

interface HotSeatListClientProps {
    profile: Profile
    sessions: HotSeatSession[]
}

export default function HotSeatListClient({ profile, sessions }: HotSeatListClientProps) {
    const supabase = useMemo(() => createClient(), [])
    const router = useRouter()
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [sessionName, setSessionName] = useState('')
    const [isPrivate, setIsPrivate] = useState(false)
    const [isCreating, setIsCreating] = useState(false)

    useScrollLock(showCreateModal)

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
                    is_private: isPrivate,
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
            <div className="max-w-xl mx-auto px-4 py-6 space-y-3">
                {sessions.length === 0 ? (
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
                    sessions.map(session => (
                        <button
                            key={session.id}
                            onClick={() => router.push(`/hot-seat/${session.slug}`)}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 transition-all active:scale-[0.98] text-left"
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
                                </div>
                                <p className="text-xs text-white/40 mt-0.5">
                                    by @{session.host?.username || 'unknown'}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 text-white/30 shrink-0">
                                <Users size={14} />
                                <span className="text-xs font-bold">{getParticipantCount(session)}</span>
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Create Session Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl">
                    <div className="bg-[#0f0a1e] border border-amber-500/10 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[85dvh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
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

                            <div>
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 ml-1">Privacy</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setIsPrivate(false)}
                                        className={`p-3 rounded-xl border text-sm font-bold transition-all ${!isPrivate
                                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                                            : 'border-white/5 bg-white/5 text-white/40 hover:bg-white/10'}`}
                                    >
                                        🌍 Public
                                    </button>
                                    <button
                                        onClick={() => setIsPrivate(true)}
                                        className={`p-3 rounded-xl border text-sm font-bold transition-all ${isPrivate
                                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                                            : 'border-white/5 bg-white/5 text-white/40 hover:bg-white/10'}`}
                                    >
                                        🔒 Private
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                                <p className="text-[11px] text-amber-300/60 leading-relaxed font-medium">
                                    ⚡ You sit in the hot seat. Friends fire rapid questions at you. Answer within <strong className="text-amber-300">30 seconds</strong> or lose <strong className="text-amber-300">10 ⭐</strong>!
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
        </div>
    )
}
