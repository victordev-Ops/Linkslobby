"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, Users, Clock, Crown, Play, Loader2, ArrowRight, X, Sparkles, Lock, Ban, Check, ChevronLeft, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { useScrollLock } from '@/hooks/useScrollLock';

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
    // Seed state with initialLobbies to avoid flash of empty
    const initialJoined = initialLobbies.filter(l => l.user_status === 'joined' || l.user_status === 'pending');
    const initialPublic = initialLobbies.filter(l => !l.is_private && !initialJoined.some(j => j.id === l.id));
    const initialPrivate = initialLobbies.filter(l => l.is_private && !initialJoined.some(j => j.id === l.id));

    const [joinedLobbies, setJoinedLobbies] = useState<Lobby[]>(initialJoined);
    const [publicLobbies, setPublicLobbies] = useState<Lobby[]>(initialPublic);
    const [privateLobbies, setPrivateLobbies] = useState<Lobby[]>(initialPrivate);

    const [isLoading, setIsLoading] = useState(false); // Start false because we have initial data
    const [hasMorePublic, setHasMorePublic] = useState(initialPublic.length === 4);
    const [hasMorePrivate, setHasMorePrivate] = useState(initialPrivate.length === 4);
    const [isLoadingMorePublic, setIsLoadingMorePublic] = useState(false);
    const [isLoadingMorePrivate, setIsLoadingMorePrivate] = useState(false);
    const PAGE_SIZE = 4;

    const [isCreating, setIsCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [joiningLobbyId, setJoiningLobbyId] = useState<string | null>(null);

    // Filter/Search states
    const [searchQuery, setSearchQuery] = useState("");

    // Creation Form State
    const [lobbyName, setLobbyName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [isPrivateMode, setIsPrivateMode] = useState(false);

    const { profile } = useAuth();
    const router = useRouter();
    const supabase = createClient();
    const effectiveUserId = currentUserId || profile?.id;

    useScrollLock(showCreateModal);

    const fetchLobbies = useCallback(async (targetGroup?: 'public' | 'private' | 'joined', loadMore = false) => {
        // Decide which range to use
        let currentSize = 0;
        if (targetGroup === 'public') currentSize = publicLobbies.length;
        else if (targetGroup === 'private') currentSize = privateLobbies.length;

        const from = loadMore ? currentSize : 0;
        const to = from + PAGE_SIZE - 1;

        if (loadMore) {
            if (targetGroup === 'public') setIsLoadingMorePublic(true);
            else if (targetGroup === 'private') setIsLoadingMorePrivate(true);
        } else {
            // If not loading more, we are refreshing a specific group or everything
            if (targetGroup === 'public') setPublicLobbies([]);
            if (targetGroup === 'private') setPrivateLobbies([]);
            if (!targetGroup) setIsLoading(true);
        }

        try {
            // 1. Fetch Joined Lobbies first to get IDs for exclusion
            let freshJoinedIds: string[] = [];
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

                        const lobbyIds = joinedData.map(d => (d.tod_lobbies as any)?.id).filter(Boolean);
                        let participantCounts: Record<string, number> = {};

                        if (lobbyIds.length > 0) {
                            const { data: participantData } = await supabase
                                .from('tod_participants')
                                .select('lobby_id')
                                .in('lobby_id', lobbyIds);

                            participantCounts = (participantData || []).reduce((acc, p) => {
                                acc[p.lobby_id] = (acc[p.lobby_id] || 0) + 1;
                                return acc;
                            }, {} as Record<string, number>);
                        }

                        const formattedJoined = joinedData.map(d => {
                            const lobby = d.tod_lobbies as any;
                            if (!lobby) return null;
                            const hostProfile = hostProfiles?.find(p => p.id === lobby.host_id);
                            return {
                                ...lobby,
                                host_profile: hostProfile ? { username: hostProfile.username } : undefined,
                                user_status: d.status,
                                is_participant: true,
                                participant_count: participantCounts[lobby.id] || 0
                            };
                        }).filter(Boolean) as Lobby[];

                        setJoinedLobbies(formattedJoined);
                        freshJoinedIds = formattedJoined.map(l => l.id);
                    }
                } else {
                    setJoinedLobbies([]);
                }
            } else {
                freshJoinedIds = joinedLobbies.map(l => l.id);
            }

            // 2. Fetch Public/Private lobbies
            const fetchPublic = !targetGroup || targetGroup === 'public';
            const fetchPrivate = !targetGroup || targetGroup === 'private';

            const fetchShared = async (is_private_filter: boolean) => {
                let query = supabase
                    .from('tod_lobbies')
                    .select(`
                        id, host_id, name, slug, category, is_private, status, created_at,
                        profiles:host_id (username)
                    `)
                    .eq('is_private', is_private_filter)
                    .neq('status', 'finished')
                    .order('created_at', { ascending: false })
                    .range(from, to);

                if (freshJoinedIds.length > 0) {
                    query = query.not('id', 'in', `(${freshJoinedIds.join(',')})`);
                }

                const { data, error } = await query;
                if (error) throw error;

                // Fetch participant counts for all lobbies
                const lobbyIds = data?.map(l => l.id) || [];
                let participantCounts: Record<string, number> = {};

                if (lobbyIds.length > 0) {
                    const { data: participantData } = await supabase
                        .from('tod_participants')
                        .select('lobby_id')
                        .in('lobby_id', lobbyIds);

                    // Count participants per lobby
                    participantCounts = (participantData || []).reduce((acc, p) => {
                        acc[p.lobby_id] = (acc[p.lobby_id] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);
                }

                return data?.map(l => ({
                    ...l,
                    host_profile: (l as any).profiles,
                    is_participant: false,
                    participant_count: participantCounts[l.id] || 0
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
        } finally {
            setIsLoading(false);
            setIsLoadingMorePublic(false);
            setIsLoadingMorePrivate(false);

            // Cache all fetched lobbies in Dexie
            const allLobbies = [...joinedLobbies, ...publicLobbies, ...privateLobbies];
            if (allLobbies.length > 0) {
                const now = Date.now();
                db.todLobbies.bulkPut(
                    allLobbies.map(l => ({
                        id: l.id,
                        host_id: l.host_id,
                        name: l.name,
                        slug: l.slug,
                        category: l.category,
                        is_private: l.is_private,
                        status: l.status,
                        created_at: l.created_at,
                        host_username: l.host_profile?.username,
                        participant_count: l.participant_count,
                        is_participant: l.is_participant,
                        user_status: l.user_status,
                        cached_at: now,
                    }))
                ).catch(() => { });
            }
        }
    }, [effectiveUserId, supabase, joinedLobbies, publicLobbies.length, privateLobbies.length]);

    useEffect(() => {
        // Load cached lobbies from Dexie on mount for instant display
        db.todLobbies
            .where('status')
            .anyOf('waiting', 'active')
            .reverse()
            .sortBy('created_at')
            .then(cached => {
                if (cached.length > 0) {
                    const pub = cached.filter(l => !l.is_private).map(l => ({
                        ...l,
                        host_profile: l.host_username ? { username: l.host_username } : undefined,
                    })) as any[];
                    const priv = cached.filter(l => l.is_private).map(l => ({
                        ...l,
                        host_profile: l.host_username ? { username: l.host_username } : undefined,
                    })) as any[];
                    if (publicLobbies.length === 0 && pub.length > 0) setPublicLobbies(pub);
                    if (privateLobbies.length === 0 && priv.length > 0) setPrivateLobbies(priv);
                }
            })
            .catch(() => { });

        fetchLobbies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveUserId]);

    useEffect(() => {
        const subscriptionTimer = setTimeout(() => {
            // Subscribe to lobby changes
            const lobbyChannel = supabase
                .channel('lobbies_list_realtime')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'tod_lobbies'
                }, () => {
                    fetchLobbies();
                })
                .subscribe();

            // Subscribe to participant changes to update counts in real-time
            const participantChannel = supabase
                .channel('participants_list_realtime')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'tod_participants'
                }, () => {
                    fetchLobbies();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(lobbyChannel);
                supabase.removeChannel(participantChannel);
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
                    is_private: isPrivateMode
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
            // Use server action for secure joining and host rewards
            const { joinLobbyAction } = await import('@/actions/tod-xp');
            const result = await joinLobbyAction(lobby.id, lobby.is_private || false);

            if (!result.success) {
                toast.error(result.message || 'Failed to join lobby');
                setJoiningLobbyId(null);
                return;
            }

            const status = result.status;

            if (status === 'joined') {
                // If it was public, the server action already awarded XP to the host
                if (lobby.is_private) {
                    // Should not happen if logic is correct, but just in case
                }
                router.push(`/tod/${lobby.slug || lobby.id}`);
            } else if (status === 'pending') {
                toast.success('Request sent! Waiting for host approval ⏳');
                fetchLobbies(); // Refresh to show pending status
                setJoiningLobbyId(null);
            } else if (status === 'rejected') {
                toast.error('Your request to join this lobby was rejected 😔');
                setJoiningLobbyId(null);
            } else if (status === 'banned') {
                toast.error('You have been banned from this lobby 🚫');
                setJoiningLobbyId(null);
            } else {
                // Fallback
                toast.error('Unknown status');
                setJoiningLobbyId(null);
            }

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
                    <div className="px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold">
                        Waiting
                    </div>
                );
            case 'active':
                return (
                    <div className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-bold flex items-center gap-1">
                        <Play size={10} />
                        Live
                    </div>
                );
            default:
                return null;
        }
    };

    const renderLobbyCard = (lobby: Lobby, isPrivateCard = false) => (
        <div
            key={lobby.id}
            onClick={() => !joiningLobbyId && joinLobby(lobby)}
            className={`group relative overflow-hidden flex flex-col justify-between p-4 rounded-3xl transition-all cursor-pointer ${isPrivateCard
                ? 'bg-slate-900/40 border border-amber-500/20 hover:border-amber-500/50 min-w-[200px] w-full md:w-auto h-40'
                : 'bg-slate-900/60 border border-slate-800/80 hover:border-red-500/40'
                } ${joiningLobbyId === lobby.id ? 'ring-2 ring-red-500' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-white font-bold text-sm truncate group-hover:text-red-400 transition-colors">
                        {lobby.name || 'Game Lobby'}
                    </h3>
                    <p className="text-[10px] text-slate-500 truncate">
                        by <span className="text-slate-400 font-semibold">{lobby.host_profile?.username || 'Host'}</span>
                    </p>
                </div>
                {getStatusBadge(lobby.status)}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-slate-800/80 text-[9px] font-black uppercase text-slate-500 tracking-wider">
                    {lobby.category || 'Casual'}
                </span>
                {lobby.is_private && <Lock size={12} className="text-amber-500 mt-0.5" />}
            </div>

            <div className="mt-auto pt-3 border-t border-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Users size={12} />
                    {lobby.participant_count || 0}
                </div>
                <div className="flex items-center gap-1.5 text-red-500 group-hover:text-red-400 transition-colors font-bold text-[11px]">
                    <span>{lobby.user_status === 'joined' ? 'Rejoin' : lobby.user_status === 'pending' ? 'View' : 'Join'}</span>
                    <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </div>
            </div>

            {joiningLobbyId === lobby.id && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="animate-spin text-red-500" size={24} />
                </div>
            )}
        </div>
    );

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

            {/* Sticky Top Navigation */}
            <div className="sticky top-0 z-[60] bg-slate-950/90 backdrop-blur-xl border-b border-white/5 shadow-xl transition-all duration-300">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
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

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-2.5 px-5 rounded-2xl font-bold shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={20} />
                        <span className="hidden sm:inline">New Lobby</span>
                    </button>
                </div>
            </div>

            <div className="relative z-10 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="mt-8 text-left">
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-2 italic tracking-tighter">
                            TRUTH OR DARE
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">
                            Choose a lobby to start playing with friends
                        </p>
                    </div>

                    <div className="space-y-12">
                        {/* 1. Joined Lobbies */}
                        {sortedJoined.length > 0 && (
                            <section>
                                <div className="flex items-center justify-between mb-5 px-1">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse" />
                                        My Games
                                    </h2>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                                        Active
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {sortedJoined.map(lobby => renderLobbyCard(lobby))}
                                </div>
                            </section>
                        )}

                        {/* 2. Private Lobbies - Mobile-First Horizontal Scroll */}
                        <section>
                            <div className="flex items-center justify-between mb-5 px-1">
                                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                    <Lock size={20} className="text-amber-500" />
                                    Private Lobbies
                                </h2>
                                <button
                                    onClick={() => fetchLobbies('private')}
                                    className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/5 px-3 py-1.5 rounded-full border border-amber-500/20 hover:bg-amber-500/10 transition-colors"
                                >
                                    Refresh List
                                </button>
                            </div>

                            {sortedPrivate.length > 0 ? (
                                <div className="flex overflow-x-auto pb-4 gap-4 snap-x no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:snap-none">
                                    {sortedPrivate.map(lobby => (
                                        <div key={lobby.id} className="snap-center min-w-[240px] md:min-w-0 w-full">
                                            {renderLobbyCard(lobby, true)}
                                        </div>
                                    ))}
                                    {hasMorePrivate && (
                                        <button
                                            onClick={() => fetchLobbies('private', true)}
                                            disabled={isLoadingMorePrivate}
                                            className="snap-center min-w-[120px] h-40 rounded-3xl bg-slate-900/30 border border-dashed border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-slate-300 transition-all font-bold"
                                        >
                                            {isLoadingMorePrivate ? <Loader2 className="animate-spin" /> : <Plus />}
                                            <span className="text-[10px] uppercase tracking-wider">Load More</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="p-10 text-center bg-slate-900/30 rounded-[2.5rem] border border-dashed border-slate-800/50">
                                    <p className="text-slate-600 text-sm italic">No private lobbies found</p>
                                </div>
                            )}
                        </section>

                        {/* 3. Public Lobbies */}
                        <section>
                            <div className="flex items-center justify-between mb-5 px-1">
                                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                    <Play size={22} className="text-red-500" />
                                    Public Lobbies
                                </h2>
                                <button
                                    onClick={() => {
                                        setSearchQuery("");
                                        fetchLobbies('public');
                                    }}
                                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50 hover:bg-slate-800 transition-colors"
                                >
                                    Browse All
                                </button>
                            </div>

                            {sortedPublic.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {sortedPublic.map(lobby => renderLobbyCard(lobby))}
                                    {hasMorePublic && (
                                        <button
                                            onClick={() => fetchLobbies('public', true)}
                                            disabled={isLoadingMorePublic}
                                            className="col-span-1 sm:col-span-2 py-5 rounded-3xl bg-slate-900/40 border border-slate-800/50 text-slate-500 font-bold hover:bg-slate-800/80 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
                                        >
                                            {isLoadingMorePublic ? <Loader2 className="animate-spin" size={20} /> : (
                                                <>
                                                    <span className="text-sm">Explore More</span>
                                                    <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="p-16 text-center bg-slate-900/30 rounded-[2.5rem] border border-dashed border-slate-800/50">
                                    <p className="text-slate-600 text-sm italic">Looking for games...</p>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Overall Empty State */}
                    {sortedJoined.length === 0 && sortedPublic.length === 0 && sortedPrivate.length === 0 && !isLoading && (
                        <div className="text-center py-20 bg-slate-900/40 backdrop-blur-xl rounded-[3rem] border border-slate-800/50 mt-10">
                            <div className="w-24 h-24 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                                <Sparkles size={40} className="text-red-500/40" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Ghost Town...</h3>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                No active games right now. Start a new one to get the party started!
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Lobby Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl">
                    <div className="bg-slate-950 border border-slate-800 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90dvh] flex flex-col">
                        <div className="p-5 sm:p-8 border-b border-slate-900 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-white italic tracking-tight">NEW PARTY</h3>
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
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Party Name</label>
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

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Game Access</label>
                                <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
                                    <button
                                        onClick={() => setIsPrivateMode(false)}
                                        className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${!isPrivateMode ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600'}`}
                                    >
                                        Public
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isPro) setIsPrivateMode(true);
                                            else toast.error("Private lobbies are a Pro feature! 💎");
                                        }}
                                        className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isPrivateMode ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600'}`}
                                    >
                                        {!isPro && <Lock size={12} className="text-amber-500" />}
                                        Private
                                    </button>
                                </div>
                                {!isPro && (
                                    <p className="text-[10px] text-slate-600 mt-3 font-medium italic ml-1">
                                        Private games require host approval for players to join.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="p-5 sm:p-8 bg-slate-900/30 border-t border-slate-900 shrink-0">
                            <button
                                onClick={createNewLobby}
                                disabled={isCreating}
                                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-red-500/20 hover:shadow-red-500/40 hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isCreating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                {isCreating ? 'Finalizing...' : 'Launch Lobby'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
