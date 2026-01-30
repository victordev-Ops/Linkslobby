"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, Users, Clock, Crown, Play, Loader2, ArrowRight, X, Sparkles, Lock, Ban, Check, ChevronLeft, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

export interface Lobby {
    id: string;
    host_id: string;
    name?: string;
    slug?: string;
    category?: string;
    is_private?: boolean;
    status: 'waiting' | 'active' | 'finished';
    created_at: string;
    host_profile?: {
        username: string;
    };
    participant_count?: number;
    is_participant?: boolean;
    user_status?: 'pending' | 'joined' | 'rejected' | 'banned';
}

const slugify = (text: string) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')   // Remove all non-word chars
        .replace(/--+/g, '-');      // Replace multiple - with single -
};

interface LobbyListClientProps {
    initialLobbies: Lobby[]
    currentUserId?: string
    isPro: boolean
}

const CATEGORIES = ["Casual", "Deep", "Spicy", "Extreme"];

export default function LobbyListClient({ initialLobbies, currentUserId, isPro }: LobbyListClientProps) {
    // Grouped Lobbies State
    const [joinedLobbies, setJoinedLobbies] = useState<Lobby[]>([]);
    const [publicLobbies, setPublicLobbies] = useState<Lobby[]>([]);
    const [privateLobbies, setPrivateLobbies] = useState<Lobby[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [hasMorePublic, setHasMorePublic] = useState(false);
    const [hasMorePrivate, setHasMorePrivate] = useState(false);
    const [isLoadingMorePublic, setIsLoadingMorePublic] = useState(false);
    const [isLoadingMorePrivate, setIsLoadingMorePrivate] = useState(false);
    const PAGE_SIZE = 10;

    const [isCreating, setIsCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [joiningLobbyId, setJoiningLobbyId] = useState<string | null>(null);

    // Creation Form State
    const [lobbyName, setLobbyName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [isPrivate, setIsPrivate] = useState(false);

    const { profile } = useAuth();
    const router = useRouter();
    const supabase = createClient();
    const effectiveUserId = currentUserId || profile?.id;

    const fetchLobbies = useCallback(async (targetGroup?: 'public' | 'private' | 'joined', loadMore = false) => {
        let currentGroupListSize = 0;
        if (targetGroup === 'public') currentGroupListSize = publicLobbies.length;
        else if (targetGroup === 'private') currentGroupListSize = privateLobbies.length;

        const from = loadMore ? currentGroupListSize : 0;
        const to = from + PAGE_SIZE - 1;

        if (loadMore) {
            if (targetGroup === 'public') setIsLoadingMorePublic(true);
            else if (targetGroup === 'private') setIsLoadingMorePrivate(true);
        } else if (!targetGroup) {
            setIsLoading(true);
        }

        try {
            // 1. Fetch Joined Lobbies (if not specifically loading another group)
            if (!targetGroup || targetGroup === 'joined') {
                if (effectiveUserId) {
                    const { data: joinedData } = await supabase
                        .from('tod_participants')
                        .select(`
                            lobby_id,
                            status,
                            tod_lobbies (*)
                        `)
                        .eq('user_id', effectiveUserId)
                        .in('status', ['joined', 'pending']);

                    if (joinedData) {
                        const hostIds = joinedData.map(d => (d.tod_lobbies as any)?.host_id).filter(Boolean);
                        const { data: hostProfiles } = await supabase
                            .from('profiles')
                            .select('id, username')
                            .in('id', hostIds);

                        const formattedJoined = joinedData.map(d => {
                            const lobby = d.tod_lobbies as any;
                            const hostProfile = hostProfiles?.find(p => p.id === lobby.host_id);
                            return {
                                ...lobby,
                                host_profile: hostProfile ? { username: hostProfile.username } : undefined,
                                user_status: d.status,
                                is_participant: true
                            };
                        });
                        setJoinedLobbies(formattedJoined);
                    }
                } else {
                    setJoinedLobbies([]);
                }
            }

            // 2. Fetch Public/Private lobbies
            const fetchPublic = !targetGroup || targetGroup === 'public';
            const fetchPrivate = !targetGroup || targetGroup === 'private';
            const joinedIds = joinedLobbies.map(l => l.id);

            const fetchShared = async (is_private: boolean) => {
                let query = supabase
                    .from('tod_lobbies')
                    .select(`
                        id, host_id, name, slug, category, is_private, status, created_at,
                        profiles:host_id (username)
                    `)
                    .eq('is_private', is_private)
                    .neq('status', 'finished')
                    .order('created_at', { ascending: false })
                    .range(from, to);

                if (joinedIds.length > 0) {
                    query = query.not('id', 'in', `(${joinedIds.join(',')})`);
                }

                const { data, error } = await query;
                if (error) throw error;
                return data?.map(l => ({
                    ...l,
                    host_profile: (l as any).profiles,
                    is_participant: false
                })) || [];
            };

            if (fetchPublic) {
                const results = await fetchShared(false);
                setPublicLobbies(prev => loadMore ? [...prev, ...results] : results);
                setHasMorePublic(results.length === PAGE_SIZE);
            }

            if (fetchPrivate) {
                const results = await fetchShared(true);
                setPrivateLobbies(prev => loadMore ? [...prev, ...results] : results);
                setHasMorePrivate(results.length === PAGE_SIZE);
            }

        } catch (error: any) {
            console.error('Error fetching lobbies:', error);
            toast.error("Failed to load lobbies");
        } finally {
            setIsLoading(false);
            setIsLoadingMorePublic(false);
            setIsLoadingMorePrivate(false);
        }
    }, [effectiveUserId, supabase, joinedLobbies, publicLobbies.length, privateLobbies.length]);

    useEffect(() => {
        fetchLobbies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveUserId]);

    useEffect(() => {
        const subscriptionTimer = setTimeout(() => {
            const channel = supabase
                .channel('lobbies_list')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'tod_lobbies'
                }, () => {
                    fetchLobbies();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }, 1500);

        return () => {
            clearTimeout(subscriptionTimer);
        };
    }, [supabase, fetchLobbies]);

    const sortGroup = (list: Lobby[]) => {
        return [...list].sort((a, b) => {
            const statusOrder: Record<string, number> = { 'waiting': 0, 'active': 1, 'finished': 2 };
            const aStatus = statusOrder[a.status] ?? 999;
            const bStatus = statusOrder[b.status] ?? 999;
            if (aStatus !== bStatus) return aStatus - bStatus;

            const categoryOrder: Record<string, number> = { 'Casual': 0, 'Deep': 1, 'Spicy': 2, 'Extreme': 3 };
            const aCat = categoryOrder[a.category || 'Casual'] ?? 999;
            const bCat = categoryOrder[b.category || 'Casual'] ?? 999;
            if (aCat !== bCat) return aCat - bCat;

            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    };

    const sortedJoined = useMemo(() => sortGroup(joinedLobbies), [joinedLobbies]);
    const sortedPublic = useMemo(() => sortGroup(publicLobbies), [publicLobbies]);
    const sortedPrivate = useMemo(() => sortGroup(privateLobbies), [privateLobbies]);

    const createNewLobby = async () => {
        if (!profile?.id) return;
        if (!lobbyName.trim()) {
            toast.error("Please enter a lobby name");
            return;
        }

        setIsCreating(true);
        try {
            const { data: lobby, error: lobbyError } = await supabase
                .from('tod_lobbies')
                .insert({
                    host_id: profile.id,
                    status: 'waiting',
                    name: lobbyName.trim(),
                    slug: `${slugify(lobbyName)}-${Math.random().toString(36).substring(2, 6)}`,
                    category: selectedCategory,
                    is_private: isPrivate
                })
                .select()
                .single();

            if (lobbyError) throw lobbyError;

            const { error: joinError } = await supabase
                .from('tod_participants')
                .insert({
                    lobby_id: lobby.id,
                    user_id: profile.id,
                    status: 'joined'
                });

            if (joinError) throw joinError;

            toast.success('Lobby created! 🎉');
            setShowCreateModal(false);
            router.push(`/tod/${lobby.slug || lobby.id}`);
        } catch (error: any) {
            console.error('Error creating lobby:', error);
            toast.error('Failed to create lobby');
        } finally {
            setIsCreating(false);
        }
    };

    const joinLobby = async (lobby: Lobby) => {
        const effectiveUserId = currentUserId || profile?.id;
        if (!effectiveUserId) {
            toast.error("Please log in to join a lobby");
            router.push('/login');
            return;
        }

        setJoiningLobbyId(lobby.id);
        try {
            const { data: existing } = await supabase
                .from('tod_participants')
                .select('id, status')
                .eq('lobby_id', lobby.id)
                .eq('user_id', effectiveUserId)
                .maybeSingle();

            if (!existing) {
                const initialStatus = lobby.is_private ? 'pending' : 'joined';

                const { error } = await supabase
                    .from('tod_participants')
                    .insert({
                        lobby_id: lobby.id,
                        user_id: effectiveUserId,
                        status: initialStatus
                    });

                if (error) throw error;

                if (lobby.is_private) {
                    toast.success('Request sent! Waiting for host approval ⏳');
                    fetchLobbies();
                    setJoiningLobbyId(null);
                    return;
                }
            } else if (existing.status === 'pending') {
                toast.info('Your request is still pending approval ⏳');
                setJoiningLobbyId(null);
                return;
            } else if (existing.status === 'rejected') {
                toast.error('Your request to join this lobby was rejected 😔');
                setJoiningLobbyId(null);
                return;
            } else if (existing.status === 'banned') {
                toast.error('You have been banned from this lobby 🚫');
                setJoiningLobbyId(null);
                return;
            }

            router.push(`/tod/${lobby.slug || lobby.id}`);
        } catch (error: any) {
            console.error('Error joining lobby:', error);
            toast.error('Failed to join lobby');
            setJoiningLobbyId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'waiting':
                return (
                    <div className="px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold">
                        Waiting
                    </div>
                );
            case 'active':
                return (
                    <div className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-1">
                        <Play size={12} />
                        Live
                    </div>
                );
            case 'finished':
                return (
                    <div className="px-2 py-1 rounded-full bg-slate-500/20 border border-slate-500/30 text-slate-400 text-xs font-bold">
                        Ended
                    </div>
                );
            default:
                return null;
        }
    };

    const renderLobbyCard = (lobby: Lobby) => (
        <div
            key={lobby.id}
            onClick={() => !joiningLobbyId && joinLobby(lobby)}
            className={`bg-slate-900/60 backdrop-blur-xl border rounded-2xl p-4 md:p-5 transition-all cursor-pointer group hover:bg-slate-800/80 ${joiningLobbyId === lobby.id ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-800/80 hover:border-red-500/40 shadow-lg hover:shadow-red-500/5'}`}
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-red-600/20 to-orange-600/20 border border-red-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group-hover:from-red-500 group-hover:to-orange-500 transition-all duration-300">
                            {joiningLobbyId === lobby.id ? (
                                <Loader2 size={18} className="text-white animate-spin" />
                            ) : (
                                <Users size={18} className="text-red-400 group-hover:text-white transition-colors" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <h3 className="text-white font-bold text-sm md:text-base truncate group-hover:text-red-400 transition-colors">
                                    {lobby.name || 'Game Lobby'}
                                </h3>
                                {lobby.is_private && <Lock size={12} className="text-amber-500 shrink-0" />}
                                {lobby.host_id === effectiveUserId && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                        <Crown size={10} className="text-amber-500" />
                                        <span className="text-[10px] font-bold text-amber-500">Host</span>
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] md:text-xs text-slate-500 truncate">
                                by <span className="text-slate-400 font-semibold">{lobby.host_profile?.username || 'Host'}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-[9px] md:text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            {lobby.category || 'Casual'}
                        </span>
                        {getStatusBadge(lobby.status)}
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/50 pt-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[10px] md:text-xs text-slate-500">
                            <Clock size={12} />
                            {new Date(lobby.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] md:text-xs text-slate-500 font-medium">
                            <Users size={12} />
                            {lobby.participant_count || 0} players
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {lobby.user_status === 'pending' && (
                            <div className="px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold flex items-center gap-1">
                                <Clock size={10} /> Pending
                            </div>
                        )}
                        {lobby.user_status === 'joined' && (
                            <div className="px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-bold flex items-center gap-1">
                                <Check size={10} /> Joined
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 text-red-500 group-hover:text-red-400 transition-colors font-bold">
                            <span className="text-xs md:text-sm">
                                {lobby.user_status === 'joined' ? 'Rejoin' :
                                    lobby.user_status === 'pending' ? 'View' :
                                        lobby.is_private ? 'Request' : 'Join'}
                            </span>
                            <ArrowRight size={14} className="translate-y-[0.5px] group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-red-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden pb-32">
            <div className="absolute inset-0 opacity-20">
                <div className="absolute top-20 left-10 w-72 h-72 bg-red-500 rounded-full blur-[120px]" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-500 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 py-6 px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Top Navigation */}
                    <div className="flex items-center justify-between mb-8">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all active:scale-95 group"
                        >
                            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                            <div className="flex items-center gap-2">
                                <LayoutGrid size={16} />
                                <span className="text-sm font-bold tracking-tight">Dashboard</span>
                            </div>
                        </button>
                    </div>

                    <div className="text-center mb-8">
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-3 italic tracking-tight">
                            Truth or Dare
                        </h1>
                        <p className="text-slate-400 text-sm md:text-base">
                            Join a lobby or create your own game
                        </p>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white p-6 rounded-2xl font-bold shadow-xl hover:shadow-red-500/50 transition-all active:scale-95 flex items-center justify-center gap-3 mb-12"
                    >
                        <Plus size={24} />
                        Create New Game
                    </button>

                    <div className="space-y-12">
                        {/* 1. Joined Lobbies */}
                        {sortedJoined.length > 0 && (
                            <section>
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        My Games
                                    </h2>
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
                                        {sortedJoined.length} Joined
                                    </span>
                                </div>
                                <div className="space-y-4">
                                    {sortedJoined.map(lobby => renderLobbyCard(lobby))}
                                </div>
                            </section>
                        )}

                        {/* 2. Public Lobbies */}
                        <section>
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Play size={20} className="text-red-400" />
                                    Public Lobbies
                                </h2>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
                                    Browse all
                                </span>
                            </div>

                            {sortedPublic.length > 0 ? (
                                <div className="space-y-4">
                                    {sortedPublic.map(lobby => renderLobbyCard(lobby))}
                                    {hasMorePublic && (
                                        <button
                                            onClick={() => fetchLobbies('public', true)}
                                            disabled={isLoadingMorePublic}
                                            className="w-full py-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 text-slate-400 font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                                        >
                                            {isLoadingMorePublic ? <Loader2 className="animate-spin" size={20} /> : (
                                                <>Load More Public <Plus size={16} className="group-hover:rotate-90 transition-transform" /></>
                                            )}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
                                    <p className="text-slate-500 text-sm italic">No public lobbies available</p>
                                </div>
                            )}
                        </section>

                        {/* 3. Private Lobbies */}
                        <section>
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Lock size={18} className="text-amber-500" />
                                    Private Lobbies
                                </h2>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
                                    Host Approval Required
                                </span>
                            </div>

                            {sortedPrivate.length > 0 ? (
                                <div className="space-y-4">
                                    {sortedPrivate.map(lobby => renderLobbyCard(lobby))}
                                    {hasMorePrivate && (
                                        <button
                                            onClick={() => fetchLobbies('private', true)}
                                            disabled={isLoadingMorePrivate}
                                            className="w-full py-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 text-slate-400 font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                                        >
                                            {isLoadingMorePrivate ? <Loader2 className="animate-spin" size={20} /> : (
                                                <>Load More Private <Plus size={16} className="group-hover:rotate-90 transition-transform" /></>
                                            )}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
                                    <p className="text-slate-500 text-sm italic">No private lobbies available</p>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Empty State (Overall) */}
                    {joinedLobbies.length === 0 && publicLobbies.length === 0 && privateLobbies.length === 0 && (
                        <div className="text-center py-12 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800 mt-8">
                            <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                                <Users size={32} className="text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No Active Lobbies</h3>
                            <p className="text-slate-400 text-sm">Be the first to create a game and invite your friends!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Lobby Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">New Game</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Lobby Name</label>
                                <input
                                    type="text"
                                    value={lobbyName}
                                    onChange={(e) => setLobbyName(e.target.value)}
                                    placeholder="Friday Night Fun..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Category</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setSelectedCategory(cat)}
                                            className={`py-3 rounded-xl text-sm font-bold border transition ${selectedCategory === cat
                                                ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30'
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Privacy</label>
                                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                                    <button
                                        onClick={() => setIsPrivate(false)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${!isPrivate ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400'}`}
                                    >
                                        Public
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isPro) setIsPrivate(true);
                                            else toast.error("Private lobbies are a Pro feature! 💎");
                                        }}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${isPrivate ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400'}`}
                                    >
                                        {!isPro && <Lock size={12} className="text-amber-500" />}
                                        Private
                                    </button>
                                </div>
                                {!isPro && (
                                    <p className="text-[10px] text-slate-500 mt-2 italic ml-1">
                                        Only host-approved players can join private lobbies.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-slate-900/50 border-t border-slate-800">
                            <button
                                onClick={createNewLobby}
                                disabled={isCreating}
                                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-red-500/20 hover:shadow-red-500/50 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isCreating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                {isCreating ? 'Creating...' : 'Start Game'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
