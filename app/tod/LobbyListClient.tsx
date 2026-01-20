"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, Users, Clock, Crown, Play, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export interface Lobby {
    id: string;
    host_id: string;
    status: 'waiting' | 'active' | 'finished';
    created_at: string;
    host_profile?: {
        username: string;
    };
    participant_count?: number;
    is_participant?: boolean;
}

interface LobbyListClientProps {
    initialLobbies: Lobby[]
    currentUserId?: string
}

export default function LobbyListClient({ initialLobbies, currentUserId }: LobbyListClientProps) {
    // We use initialLobbies as the starting state
    const [lobbies, setLobbies] = useState<Lobby[]>(initialLobbies);
    const [isCreating, setIsCreating] = useState(false);
    // We can skip the initial full-screen loading state since we have data
    const [isLoading, setIsLoading] = useState(false);

    const { profile } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    // Realtime subscription setup
    useEffect(() => {
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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchLobbies = async () => {
        // If we don't have a user ID (even from props), we might not be able to check participation correctly
        // but we can still fetch the public list.
        const effectiveUserId = currentUserId || profile?.id;

        try {
            // Fetch all lobbies with host profiles
            const { data: lobbyData, error: lobbyError } = await supabase
                .from('tod_lobbies')
                .select(`
          id,
          host_id,
          status,
          created_at,
          profiles:host_id (username)
        `)
                .order('created_at', { ascending: false })
                .limit(20);

            if (lobbyError) throw lobbyError;

            // Fetch participant counts and user participation
            const lobbyIds = lobbyData?.map(l => l.id) || [];
            const { data: participantData } = await supabase
                .from('tod_participants')
                .select('lobby_id, user_id')
                .in('lobby_id', lobbyIds);

            const lobbiesWithDetails = lobbyData?.map(lobby => {
                const participants = participantData?.filter(p => p.lobby_id === lobby.id) || [];
                return {
                    ...lobby,
                    host_profile: lobby.profiles,
                    participant_count: participants.length,
                    is_participant: effectiveUserId ? participants.some(p => p.user_id === effectiveUserId) : false
                };
            }) || [];

            // Cast to any to avoid type mismatch with the complex join/map structure above vs interface
            setLobbies(lobbiesWithDetails as any);
        } catch (error: any) {
            console.error('Error fetching lobbies:', error);
            // Silent error or small toast?
            // toast.error('Failed to update lobbies');
        }
    };

    const createNewLobby = async () => {
        if (!profile?.id) return;

        setIsCreating(true);
        try {
            // Create lobby
            const { data: lobby, error: lobbyError } = await supabase
                .from('tod_lobbies')
                .insert({ host_id: profile.id, status: 'waiting' })
                .select()
                .single();

            if (lobbyError) throw lobbyError;

            // Auto-join as participant
            const { error: joinError } = await supabase
                .from('tod_participants')
                .insert({ lobby_id: lobby.id, user_id: profile.id });

            if (joinError) throw joinError;

            toast.success('Lobby created! 🎉');
            router.push(`/tod/${lobby.id}`);
        } catch (error: any) {
            console.error('Error creating lobby:', error);
            toast.error('Failed to create lobby');
        } finally {
            setIsCreating(false);
        }
    };

    const joinLobby = async (lobbyId: string) => {
        if (!profile?.id) {
            toast.error("Please log in to join");
            return;
        }

        try {
            // Check if already a participant
            const { data: existing } = await supabase
                .from('tod_participants')
                .select('id')
                .eq('lobby_id', lobbyId)
                .eq('user_id', profile.id)
                .single();

            if (!existing) {
                const { error } = await supabase
                    .from('tod_participants')
                    .insert({ lobby_id: lobbyId, user_id: profile.id });

                if (error) throw error;
            }

            router.push(`/tod/${lobbyId}`);
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
                        onClick={createNewLobby}
                        disabled={isCreating}
                        className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white p-6 rounded-2xl font-bold shadow-xl hover:shadow-red-500/50 transition-all active:scale-95 flex items-center justify-center gap-3 mb-8 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="animate-spin" size={24} />
                                Creating Lobby...
                            </>
                        ) : (
                            <>
                                <Plus size={24} />
                                Create New Game
                            </>
                        )}
                    </button>

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
                                {lobbies.map((lobby) => (
                                    <div
                                        key={lobby.id}
                                        onClick={() => joinLobby(lobby.id)}
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
                                                            {lobby.participant_count || 0} Player{lobby.participant_count !== 1 ? 's' : ''}
                                                        </p>
                                                        {getStatusBadge(lobby.status)}
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

                                            <div className="flex items-center gap-2 text-red-400 group-hover:text-red-300 transition-colors">
                                                <span className="text-sm font-bold">
                                                    {lobby.is_participant ? 'Rejoin' : 'Join'}
                                                </span>
                                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
