"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, Users, Play, Loader2, ArrowRight, X, Dices, Trash2, ChevronLeft, Share2, Crown, Flame } from 'lucide-react';
import { ClosedLobbyBadge } from '@/components/tod/ui/LobbyCloseToggle';
import { toast } from 'sonner';
import { useScrollLock } from '@/hooks/useScrollLock';
import VerifiedBadge from '@/components/VerifiedBadge';

export interface Lobby {
    id: string;
    host_id: string;
    name?: string;
    slug?: string;
    category?: string;
    status: 'waiting' | 'active' | 'finished' | 'closed';
    created_at: string;
    host_profile?: {
        username: string;
        avatar_url?: string;
        is_pro?: boolean;
    };
    participant_count?: number;
    is_participant?: boolean;
    user_status?: 'joined' | 'banned';
}

interface LobbyListClientProps {
    initialLobbies: Lobby[]
    currentUserId?: string
    isPro: boolean
}

const CATEGORIES = ["Casual", "Deep", "Spicy", "Extreme"];
const FREE_LIMIT = 1;
const PRO_LIMIT = 3;

export default function LobbyListClient({ initialLobbies, currentUserId, isPro }: LobbyListClientProps) {
    const [myLobbies, setMyLobbies] = useState<Lobby[]>(initialLobbies);
    const [isLoading, setIsLoading] = useState(false);

    const [isCreating, setIsCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [joiningLobbyId, setJoiningLobbyId] = useState<string | null>(null);

    const [lobbyName, setLobbyName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [confirmLobby, setConfirmLobby] = useState<Lobby | null>(null);

    const [showLimitModal, setShowLimitModal] = useState(false);
    const [userLobbies, setUserLobbies] = useState<any[]>([]);
    const [isDeletingLobby, setIsDeletingLobby] = useState<string | null>(null);
    const [pendingCreateAfterDelete, setPendingCreateAfterDelete] = useState(false);
    const [newlyCreatedLobby, setNewlyCreatedLobby] = useState<{ slug: string; id: string; name?: string } | null>(null);

    const { profile } = useAuth();
    const router = useRouter();
    const supabaseRef = useRef(createClient());
    const supabase = supabaseRef.current;
    const effectiveUserId = currentUserId || profile?.id;

    const maxLobbies = isPro ? PRO_LIMIT : FREE_LIMIT;
    const atLimit = myLobbies.filter(l => l.host_id === effectiveUserId).length >= maxLobbies;

    useScrollLock(showCreateModal);

    const fetchLobbies = useCallback(async () => {
        if (!effectiveUserId) {
            setMyLobbies([]);
            return;
        }
        try {
            const { data: rows } = await supabase
                .from('tod_participants')
                .select(`
                    status,
                    tod_lobbies (
                        id, host_id, name, slug, category, status, created_at,
                        profiles:host_id (username)
                    )
                `)
                .eq('user_id', effectiveUserId)
                .eq('status', 'joined');

            const filtered = (rows || []).filter(r => (r as any).tod_lobbies);
            const lobbyIds = filtered.map(r => (r as any).tod_lobbies.id);

            let participantCounts: Record<string, number> = {};
            if (lobbyIds.length > 0) {
                const { data: countRows } = await supabase
                    .from('tod_participants')
                    .select('lobby_id')
                    .eq('status', 'joined')
                    .in('lobby_id', lobbyIds);

                participantCounts = (countRows || []).reduce((acc, p) => {
                    acc[p.lobby_id] = (acc[p.lobby_id] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);
            }

            const formatted = filtered.map(r => {
                const lobby = (r as any).tod_lobbies;
                return {
                    ...lobby,
                    host_profile: lobby.profiles,
                    participant_count: participantCounts[lobby.id] || 0,
                    is_participant: true,
                    user_status: (r as any).status,
                } as Lobby;
            });

            setMyLobbies(formatted);
        } catch (error) {
            console.error('Error fetching lobbies:', error);
        }
    }, [effectiveUserId, supabase]);

    useEffect(() => {
        fetchLobbies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveUserId]);

    useEffect(() => {
        if (!effectiveUserId) return;

        const lobbyChannel = supabase
            .channel('lobbies_list_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tod_lobbies'
            }, (payload) => {
                if (payload.eventType === 'DELETE') {
                    const deletedId = (payload.old as { id?: string } | null)?.id;
                    if (deletedId) {
                        setMyLobbies(prev => prev.filter(l => l.id !== deletedId));
                    }
                }
                fetchLobbies();
            })
            .subscribe();

        const participantChannel = supabase
            .channel('participants_list_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tod_participants',
                filter: `user_id=eq.${effectiveUserId}`
            }, () => {
                fetchLobbies();
            })
            .subscribe();

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchLobbies();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            supabase.removeChannel(lobbyChannel);
            supabase.removeChannel(participantChannel);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [supabase, effectiveUserId, fetchLobbies]);

    const sortedLobbies = useMemo(() => {
        return [...myLobbies].sort((a, b) => {
            const statusOrder: Record<string, number> = { 'waiting': 0, 'active': 1, 'finished': 2, 'closed': 3 };
            const aStatus = statusOrder[a.status] ?? 999;
            const bStatus = statusOrder[b.status] ?? 999;
            if (aStatus !== bStatus) return aStatus - bStatus;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [myLobbies]);

    const openCreateModal = () => {
        if (atLimit) {
            openLimitModal(false);
            return;
        }
        setShowCreateModal(true);
    };

    const openLimitModal = async (createAfterDelete: boolean) => {
        const { getUserLobbies } = await import('@/actions/tod-xp');
        const lobbies = await getUserLobbies();
        setUserLobbies(lobbies);
        setPendingCreateAfterDelete(createAfterDelete);
        setShowLimitModal(true);
    };

    const createNewLobby = async () => {
        if (!effectiveUserId) return;
        if (!lobbyName.trim()) {
            toast.error("Please enter a lobby name");
            return;
        }

        setIsCreating(true);
        try {
            const { createLobbyAction } = await import('@/actions/tod-xp');
            const result = await createLobbyAction(lobbyName.trim(), selectedCategory);

            if (!result.success) {
                if (result.limitReached) {
                    setShowCreateModal(false);
                    await openLimitModal(true);
                } else {
                    toast.error(result.message || 'Failed to create lobby');
                }
                return;
            }

            toast.success('Lobby created!');
            setShowCreateModal(false);
            setLobbyName("");
            setNewlyCreatedLobby({ slug: result.lobby.slug || result.lobby.id, id: result.lobby.id, name: result.lobby.name });
            fetchLobbies();
        } catch (error: any) {
            console.error('Error creating lobby:', error);
            toast.error('Failed to create lobby');
        } finally {
            setIsCreating(false);
        }
    };

    const enterLobby = (lobby: Lobby) => {
        if (lobby.status === 'closed') {
            toast.error('This lobby is closed 🔒');
            return;
        }
        router.push(`/tod/${lobby.slug || lobby.id}`);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'waiting':
                return (
                    <div className="px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold">
                        Waiting
                    </div>
                );
            case 'active':
                return (
                    <div className="px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-bold flex items-center gap-1">
                        <Play size={10} />
                        Live
                    </div>
                );
            case 'closed':
                return <ClosedLobbyBadge />;
            default:
                return null;
        }
    };

    const renderLobbyCard = (lobby: Lobby) => {
        const isHost = lobby.host_id === effectiveUserId;
        return (
            <div
                key={lobby.id}
                onClick={() => !joiningLobbyId && setConfirmLobby(lobby)}
                className={`group relative overflow-hidden w-full rounded-[2rem] border cursor-pointer transition-all active:scale-[0.98] border-green-500/30 hover:border-green-500/60 bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-5 sm:p-6 ${joiningLobbyId === lobby.id ? 'ring-2 ring-red-500' : ''}`}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                        {!isHost && (
                            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-slate-800 flex items-center justify-center relative">
                                {lobby.host_profile?.avatar_url ? (
                                    <img src={lobby.host_profile.avatar_url} alt={lobby.host_profile.username} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-slate-400 font-bold text-xs uppercase">
                                        {(lobby.host_profile?.username || '?').slice(0, 2)}
                                    </span>
                                )}
                                {lobby.host_profile?.is_pro && (
                                    <span className="absolute -bottom-1 -right-1">
                                        <VerifiedBadge size={12} />
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <h3 className="text-white font-black text-lg sm:text-xl truncate group-hover:text-red-400 transition-colors leading-tight">
                                {lobby.name || 'Game Lobby'}
                            </h3>
                            <p className="text-xs text-slate-500 truncate mt-1">
                                {isHost ? (
                                    <span className="text-amber-400 font-semibold flex items-center gap-1"><Crown size={12} /> You're hosting</span>
                                ) : (
                                    <>hosted by <span className="text-slate-400 font-semibold">{lobby.host_profile?.username || 'a friend'}</span></>
                                )}
                            </p>
                        </div>
                    </div>
                    {getStatusBadge(lobby.status)}
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        {lobby.category || 'Casual'}
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/50 text-[10px] font-bold text-slate-500">
                        <Users size={11} />
                        {lobby.participant_count || 0} in the game
                    </span>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/50 flex items-center justify-between">
                    <span className="text-slate-500 text-xs font-medium">Tap to jump back in</span>
                    <div className="flex items-center gap-1.5 text-red-500 group-hover:text-red-400 transition-colors font-black text-xs uppercase tracking-wider">
                        <span>Enter</span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>

                {joiningLobbyId === lobby.id && (
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="animate-spin text-red-500" size={28} />
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-red-500" />
                <p className="text-slate-500 font-bold animate-pulse">Loading Lobbies...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative pb-32">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-red-500 rounded-full blur-[120px]" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-500 rounded-full blur-[120px]" />
            </div>

            {/* Sticky Top Navigation — back button only */}
            <div className="sticky top-0 z-[60] bg-slate-950/90 backdrop-blur-xl border-b border-white/5 shadow-xl transition-all duration-300">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all active:scale-95 group"
                    >
                        <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-bold tracking-tight">Dashboard</span>
                    </button>
                </div>
            </div>

            <div className="relative z-10 px-4">
                <div className="max-w-2xl mx-auto">
                    <div className="mt-8 text-left">
                        <h1 className="text-4xl sm:text-5xl font-black text-white mb-2 italic tracking-tighter">
                            TRUTH OR DARE
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">
                            {isPro ? `Run up to ${PRO_LIMIT} lobbies and keep the party going` : `Roll the dice, invite your crew, spill it all`}
                        </p>
                    </div>

                    {/* Big, unmissable CTA */}
                    <button
                        onClick={openCreateModal}
                        className="group relative w-full mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-r from-red-500 to-orange-500 p-6 sm:p-7 shadow-xl shadow-red-500/25 hover:shadow-red-500/40 active:scale-[0.98] transition-all text-left flex items-center gap-4"
                    >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                            <Dices size={30} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-black text-lg sm:text-xl italic tracking-tight">
                                Start a New Lobby
                            </p>
                            <p className="text-white/80 text-xs sm:text-sm font-medium mt-0.5">
                                Create it, share the link, let the chaos begin 🔥
                            </p>
                        </div>
                        <Plus size={26} className="text-white shrink-0 group-hover:rotate-90 transition-transform duration-300" />
                    </button>

                    {/* My Lobbies — vertical stack */}
                    <div className="mt-10">
                        {sortedLobbies.length > 0 ? (
                            <>
                                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 px-1">
                                    Your Games
                                </h2>
                                <div className="flex flex-col gap-4">
                                    {sortedLobbies.map(lobby => renderLobbyCard(lobby))}
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-16 bg-slate-900/40 backdrop-blur-xl rounded-[3rem] border border-slate-800/50 mt-4">
                                <div className="w-24 h-24 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                                    <Dices size={40} className="text-red-500/40" />
                                </div>
                                <h3 className="text-2xl font-black text-white mb-2">No Games Yet</h3>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                    Kick things off — create a lobby and drop the link in your group chat.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Lobby Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl">
                    <div className="bg-slate-950 border border-slate-800 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90dvh] flex flex-col">
                        <div className="p-5 sm:p-8 border-b border-slate-900 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-white italic tracking-tight">NEW LOBBY</h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configure your game</p>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-500 hover:text-white transition active:scale-95"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-5 sm:p-8 space-y-5 sm:space-y-8 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Lobby Name</label>
                                <input
                                    type="text"
                                    value={lobbyName}
                                    onChange={(e) => setLobbyName(e.target.value)}
                                    placeholder="FRIDAY NIGHT CHAOS..."
                                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold placeholder:text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Vibe</label>
                                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setSelectedCategory(cat)}
                                            className={`py-4 rounded-2xl text-[11px] font-black uppercase tracking-wider border-2 transition-all active:scale-95 ${selectedCategory === cat
                                                ? 'bg-red-500 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                                                : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-700'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <p className="text-[10px] text-slate-600 font-medium italic ml-1">
                                Anyone with the link can join once it's created.
                            </p>
                        </div>

                        <div className="p-5 sm:p-8 bg-slate-900/30 border-t border-slate-900 shrink-0">
                            <button
                                onClick={createNewLobby}
                                disabled={isCreating}
                                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-red-500/20 hover:shadow-red-500/40 hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isCreating ? <Loader2 className="animate-spin" size={20} /> : <Dices size={20} />}
                                {isCreating ? 'Finalizing...' : 'Launch Lobby'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lobby Limit Modal */}
            {showLimitModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setShowLimitModal(false); setPendingCreateAfterDelete(false); }} />
                    <div className="relative bg-[#0f0f1a] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-white">Lobby Limit Reached</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {isPro
                                        ? `Pro is capped at ${PRO_LIMIT} lobbies. Delete one to create a new one.`
                                        : `Free accounts get 1 lobby. Delete it, or go Pro for up to ${PRO_LIMIT}.`}
                                </p>
                            </div>
                            <button onClick={() => { setShowLimitModal(false); setPendingCreateAfterDelete(false); }} className="p-2 hover:bg-white/5 rounded-xl transition">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                            {userLobbies.map(lobby => (
                                <div key={lobby.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800/50 rounded-2xl">
                                    <div className="min-w-0">
                                        <p className="font-bold text-white text-sm truncate">{lobby.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded">{lobby.category || 'Casual'}</span>
                                            <span className="text-[10px] text-slate-600">{lobby.status || 'active'}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            setIsDeletingLobby(lobby.id);
                                            const { deleteLobbyAction } = await import('@/actions/tod-xp');
                                            const result = await deleteLobbyAction(lobby.id);
                                            if (result.success) {
                                                setUserLobbies(prev => prev.filter(l => l.id !== lobby.id));
                                                toast.success('Lobby deleted');
                                                fetchLobbies();
                                                if (pendingCreateAfterDelete) {
                                                    setShowLimitModal(false);
                                                    setPendingCreateAfterDelete(false);
                                                    setShowCreateModal(true);
                                                }
                                            } else {
                                                toast.error(result.message || 'Failed to delete lobby');
                                            }
                                            setIsDeletingLobby(null);
                                        }}
                                        disabled={isDeletingLobby === lobby.id}
                                        className="p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition disabled:opacity-50 shrink-0"
                                    >
                                        {isDeletingLobby === lobby.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                    </button>
                                </div>
                            ))}
                            {userLobbies.length === 0 && (
                                <p className="text-center text-slate-600 py-8 text-sm">No lobbies found</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Enter Lobby Confirmation Modal */}
            {confirmLobby && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => !joiningLobbyId && setConfirmLobby(null)}
                    />
                    <div className="relative bg-[#0f0f1a] border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                                <Flame size={22} className="text-orange-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-1">Enter Lobby?</h3>
                            <p className="text-slate-500 text-sm mb-1">
                                <span className="font-bold text-white">{confirmLobby.name || 'Game Lobby'}</span>
                            </p>
                            <p className="text-slate-600 text-xs">
                                {confirmLobby.category || 'Casual'}
                            </p>
                        </div>
                        <div className="p-4 pt-0 flex gap-3">
                            <button
                                onClick={() => setConfirmLobby(null)}
                                disabled={!!joiningLobbyId}
                                className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all active:scale-95 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const lobby = confirmLobby;
                                    setConfirmLobby(null);
                                    if (lobby) enterLobby(lobby);
                                }}
                                disabled={!!joiningLobbyId}
                                className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <ArrowRight size={14} />
                                Enter
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Lobby Modal — shown after creation */}
            {newlyCreatedLobby && (() => {
                const lobbyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/tod/${newlyCreatedLobby.slug}`;
                const handleShare = async () => {
                    const shareData = {
                        title: `Join my Truth or Dare lobby! 🔥`,
                        text: `Come play Truth or Dare with me on Say! Join "${newlyCreatedLobby.name || 'my lobby'}" 🎉`,
                        url: lobbyUrl,
                    };
                    try {
                        if (navigator.share && navigator.canShare?.(shareData)) {
                            await navigator.share(shareData);
                        } else {
                            await navigator.clipboard.writeText(lobbyUrl);
                            toast.success('Link copied! Send it to your friends 🔗');
                        }
                    } catch (err: any) {
                        if (err?.name !== 'AbortError') {
                            await navigator.clipboard.writeText(lobbyUrl);
                            toast.success('Link copied! Send it to your friends 🔗');
                        }
                    }
                };
                return (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl">
                        <div className="bg-slate-950 border border-slate-800 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center mb-1">
                                    <Dices size={28} className="text-orange-400" />
                                </div>
                                <h3 className="text-2xl font-black text-white italic tracking-tight">Lobby Created! 🎉</h3>
                                <p className="text-slate-400 text-sm">
                                    <span className="font-bold text-white">{newlyCreatedLobby.name}</span> is ready to go.<br />
                                    Invite your friends to join the fun!
                                </p>
                            </div>

                            <div className="px-6 sm:px-8 pb-4">
                                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
                                    <span className="text-slate-500 text-xs truncate flex-1 font-mono">{lobbyUrl}</span>
                                    <button
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(lobbyUrl);
                                            toast.success('Link copied!');
                                        }}
                                        className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition text-[10px] font-black uppercase tracking-wider"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>

                            <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex flex-col gap-3">
                                <button
                                    onClick={handleShare}
                                    className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-red-500/20 hover:shadow-red-500/40 hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Share2 size={18} />
                                    Invite Friends
                                </button>
                                <button
                                    onClick={() => {
                                        setNewlyCreatedLobby(null);
                                        router.push(`/tod/${newlyCreatedLobby!.slug}`);
                                    }}
                                    className="w-full py-4 rounded-[1.5rem] font-black uppercase tracking-widest border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <ArrowRight size={18} />
                                    Enter Lobby
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
