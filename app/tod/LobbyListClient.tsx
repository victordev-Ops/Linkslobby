"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, Users, Clock, Crown, Play, Loader2, ArrowRight, X, Sparkles, Lock, Ban, Check } from 'lucide-react';
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
    // We use initialLobbies as the starting state
    const [lobbies, setLobbies] = useState<Lobby[]>(initialLobbies);
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Creation Form State
    const [lobbyName, setLobbyName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [isPrivate, setIsPrivate] = useState(false);

    // We can skip the initial full-screen loading state since we have data
    const [isLoading, setIsLoading] = useState(false);
    const [hasMoreLobbies, setHasMoreLobbies] = useState(initialLobbies.length === 10);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const PAGE_SIZE = 10;

    const { profile } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    // Realtime subscription setup
    // IMPORTANT: Delay subscription to avoid conflicts during page load
    useEffect(() => {
        // Wait for page to fully load before establishing WebSocket connection
        const subscriptionTimer = setTimeout(() => {
            const channel = supabase
                .channel('lobbies_list')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'tod_lobbies'
                }, () => {
                    // Refresh lobbies on change
                    fetchLobbies();
                })
                .subscribe((status) => {
                    // Handle subscription errors gracefully
                    if (status === 'CHANNEL_ERROR') {
                        console.error('Realtime subscription error - will retry');
                        // The channel will automatically retry
                    }
                });

            return () => {
                supabase.removeChannel(channel);
            };
        }, 1500); // 1.5 second delay to ensure page is loaded

        return () => {
            clearTimeout(subscriptionTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchLobbies = async (loadMore = false) => {
        // If we don't have a user ID (even from props), we might not be able to check participation correctly
        // but we can still fetch the public list.
        const effectiveUserId = currentUserId || profile?.id;
        const from = loadMore ? lobbies.length : 0;
        const to = from + PAGE_SIZE - 1;

        if (loadMore) setIsLoadingMore(true);

        try {
            // Fetch all lobbies with host profiles
            const { data: lobbyData, error: lobbyError } = await supabase
                .from('tod_lobbies')
                .select(`
          id,
          host_id,
          name,
          slug,
          category,
          is_private,
          status,
          created_at,
          profiles:host_id (username)
        `)
                .order('category', { ascending: true })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (lobbyError) throw lobbyError;

            // Fetch participant counts and user participation
            const lobbyIds = lobbyData?.map(l => l.id) || [];
            const { data: participantData } = await supabase
                .from('tod_participants')
                .select('lobby_id, user_id')
                .in('lobby_id', lobbyIds);

            const lobbiesWithDetails = lobbyData?.map(lobby => {
                const participants = participantData?.filter(p => p.lobby_id === lobby.id) || [];
                const userPart = effectiveUserId ? participants.find(p => p.user_id === effectiveUserId) : null;
                // Count only joined participants (exclude pending and rejected)
                const joinedCount = participants.filter(p => p.status === 'joined').length;

                return {
                    ...lobby,
                    host_profile: lobby.profiles,
                    participant_count: joinedCount, // Use filtered count
                    is_participant: !!userPart,
                    user_status: userPart?.status
                };
            }) || [];

            // Cast to any to avoid type mismatch with the complex join/map structure above vs interface
            if (loadMore) {
                setLobbies(prev => [...prev, ...lobbiesWithDetails] as any);
            } else {
                setLobbies(lobbiesWithDetails as any);
            }
            setHasMoreLobbies(lobbiesWithDetails.length === PAGE_SIZE);
        } catch (error: any) {
            console.error('Error fetching lobbies:', error);
        } finally {
            if (loadMore) setIsLoadingMore(false);
        }
    };

    // Sort lobbies: user's lobbies first, then by category, status, and date
    const sortedLobbies = useMemo(() => {
        const effectiveUserId = currentUserId || profile?.id;

        return [...lobbies].sort((a, b) => {
            // 1. User's own lobbies first
            const aIsOwn = effectiveUserId && a.host_id === effectiveUserId;
            const bIsOwn = effectiveUserId && b.host_id === effectiveUserId;
            if (aIsOwn !== bIsOwn) return aIsOwn ? -1 : 1;

            // 2. Category order (Casual → Deep → Spicy → Extreme)
            const categoryOrder: Record<string, number> = { 'Casual': 0, 'Deep': 1, 'Spicy': 2, 'Extreme': 3 };
            const aCat = categoryOrder[a.category || 'Casual'] ?? 999;
            const bCat = categoryOrder[b.category || 'Casual'] ?? 999;
            if (aCat !== bCat) return aCat - bCat;

            // 3. Status order (waiting → active → finished)
            const statusOrder: Record<string, number> = { 'waiting': 0, 'active': 1, 'finished': 2 };
            const aStatus = statusOrder[a.status] ?? 999;
            const bStatus = statusOrder[b.status] ?? 999;
            if (aStatus !== bStatus) return aStatus - bStatus;

            // 4. Newest first
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [lobbies, currentUserId, profile?.id]);

    const createNewLobby = async () => {
        if (!profile?.id) return;
        if (!lobbyName.trim()) {
            toast.error("Please enter a lobby name");
            return;
        }

        setIsCreating(true);
        try {
            // Create lobby
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

            // Auto-join as participant (already 'joined' status since you are host)
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

        try {
            // Check if already a participant
            const { data: existing } = await supabase
                .from('tod_participants')
                .select('id, status')
                .eq('lobby_id', lobby.id)
                .eq('user_id', effectiveUserId)
                .maybeSingle();

            if (!existing) {
                // For private lobbies, request to join (status = 'pending')
                // For public lobbies, join immediately (status = 'joined')
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
                    return;
                }
            } else if (existing.status === 'pending') {
                toast.info('Your request is still pending approval ⏳');
                return;
            } else if (existing.status === 'rejected') {
                toast.error('Your request to join this lobby was rejected 😔');
                return;
            } else if (existing.status === 'banned') {
                toast.error('You have been banned from this lobby 🚫');
                return;
            }

            router.push(`/tod/${lobby.slug || lobby.id}`);
        } catch (error: any) {
            console.error('Error joining lobby:', error);
            toast.error('Failed to join lobby');
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
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950 to-slate-950 flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-red-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950 to-slate-950 relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute top-20 left-10 w-72 h-72 bg-red-500 rounded-full blur-[120px]" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-500 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 min-h-screen py-6 px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-3 italic">
                            Truth or Dare
                        </h1>
                        <p className="text-slate-400 text-sm md:text-base">
                            Create a game or join an existing lobby
                        </p>
                    </div>

                    {/* Create Button */}
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white p-6 rounded-2xl font-bold shadow-xl hover:shadow-red-500/50 transition-all active:scale-95 flex items-center justify-center gap-3 mb-8"
                    >
                        <Plus size={24} />
                        Create New Game
                    </button>

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
                                                    if (isPro) {
                                                        setIsPrivate(true);
                                                    } else {
                                                        toast.error("Private lobbies are a Pro feature! 💎");
                                                    }
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

                    {/* Active Lobbies Section */}
                    {lobbies.length > 0 && (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white">Available Lobbies</h2>
                                <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-sm font-bold">
                                    {lobbies.length} Active
                                </div>
                            </div>

                            <div className="space-y-3">
                                {sortedLobbies.map((lobby) => (
                                    <div
                                        key={lobby.id}
                                        onClick={() => joinLobby(lobby)}
                                        className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 hover:border-red-500/50 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
                                                    <Users size={20} className="text-white" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-white font-bold">
                                                            {lobby.name || (lobby.participant_count ? `${lobby.participant_count} Player${lobby.participant_count !== 1 ? 's' : ''}` : 'New Lobby')}
                                                        </p>
                                                        {getStatusBadge(lobby.status)}
                                                        {lobby.is_private && <Lock size={12} className="text-amber-500" />}
                                                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                            {lobby.category || 'Casual'}
                                                        </span>
                                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-slate-400">
                                                            <Users size={10} />
                                                            {lobby.participant_count || 0}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-400">
                                                        Hosted by{' '}
                                                        <span className="text-slate-300 font-semibold">
                                                            {lobby.host_profile?.username || 'Unknown'}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            {lobby.host_id === (currentUserId || profile?.id) && (
                                                <div className="px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center gap-1">
                                                    <Crown size={12} className="text-amber-400" />
                                                    <span className="text-xs font-bold text-amber-300">You</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                <Clock size={12} />
                                                {new Date(lobby.created_at).toLocaleString()}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {/* User Status Badge */}
                                                {lobby.user_status === 'banned' && (
                                                    <div className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-1">
                                                        <Ban size={12} />
                                                        Banned
                                                    </div>
                                                )}
                                                {lobby.user_status === 'pending' && (
                                                    <div className="px-2 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-bold flex items-center gap-1">
                                                        <Clock size={12} />
                                                        Pending
                                                    </div>
                                                )}
                                                {lobby.user_status === 'joined' && (
                                                    <div className="px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-bold flex items-center gap-1">
                                                        <Check size={12} />
                                                        Joined
                                                    </div>
                                                )}

                                                {/* Action Text */}
                                                {lobby.user_status !== 'banned' && (
                                                    <div className="flex items-center gap-2 text-red-400 group-hover:text-red-300 transition-colors">
                                                        <span className="text-sm font-bold">
                                                            {lobby.user_status === 'joined' ? 'Rejoin' :
                                                                lobby.user_status === 'pending' ? 'View' :
                                                                    lobby.user_status === 'rejected' ? 'Rejected' :
                                                                        lobby.is_private ? 'Request' : 'Join'}
                                                        </span>
                                                        {lobby.user_status !== 'rejected' && (
                                                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {hasMoreLobbies && (
                                <button
                                    onClick={() => fetchLobbies(true)}
                                    disabled={isLoadingMore}
                                    className="w-full mt-6 py-4 rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-400 font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                                >
                                    {isLoadingMore ? (
                                        <Loader2 className="animate-spin" size={20} />
                                    ) : (
                                        <>
                                            Load More Lobbies
                                            <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                                        </>
                                    )}
                                </button>
                            )}
                        </>
                    )}

                    {/* Empty State */}
                    {lobbies.length === 0 && (
                        <div className="text-center py-12 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800">
                            <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                                <Users size={32} className="text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No Active Lobbies</h3>
                            <p className="text-slate-400 text-sm">
                                Be the first to create a game and invite your friends!
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
