"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, Users, Clock, Crown, Play, Loader2, ArrowRight, X, Sparkles, Lock, Ban, Check, ChevronLeft, ChevronDown, LayoutGrid, Trash2, Filter, Share2, LockOpen } from 'lucide-react';
import { ClosedLobbyBadge } from '@/components/tod/ui/LobbyCloseToggle';
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
    status: 'waiting' | 'active' | 'finished' | 'closed';
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
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
};

interface LobbyListClientProps {
    initialLobbies: Lobby[]
    currentUserId?: string
    isPro: boolean
}

const CATEGORIES = ["Casual", "Deep", "Spicy", "Extreme"];

export default function LobbyListClient({ initialLobbies, currentUserId, isPro }: LobbyListClientProps) {
    const initialJoined = initialLobbies.filter(l => l.user_status === 'joined' || l.user_status === 'pending');
    const initialPublic = initialLobbies.filter(
        l => !l.is_private && l.status !== 'closed' && !initialJoined.some(j => j.id === l.id)
    );
    const initialPrivate = initialLobbies.filter(
        l => l.is_private && l.status !== 'closed' && !initialJoined.some(j => j.id === l.id)
    );

    const [joinedLobbies, setJoinedLobbies] = useState<Lobby[]>(initialJoined);
    const [publicLobbies, setPublicLobbies] = useState<Lobby[]>(initialPublic);
    const [extraPublicLobbies, setExtraPublicLobbies] = useState<Lobby[]>([]);
    const [privateLobbies, setPrivateLobbies] = useState<Lobby[]>(initialPrivate);
    const [extraPrivateLobbies, setExtraPrivateLobbies] = useState<Lobby[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [hasMorePublic, setHasMorePublic] = useState(initialPublic.length === 4);
    const [hasMorePrivate, setHasMorePrivate] = useState(initialPrivate.length === 4);
    
    const [isLoadingMorePublic, setIsLoadingMorePublic] = useState(false);
    const [isLoadingMorePrivate, setIsLoadingMorePrivate] = useState(false);
    
    // Stable refs to prevent intersection observer from re-triggering infinitely
    const isLoadingMorePublicRef = useRef(false);
    const isLoadingMorePrivateRef = useRef(false);

    const PAGE_SIZE = 4;

    const [isCreating, setIsCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [joiningLobbyId, setJoiningLobbyId] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [lobbyName, setLobbyName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [isPrivateMode, setIsPrivateMode] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string>('All');
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
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

    const publicLobbiesLenRef = useRef(publicLobbies.length);
    const privateLobbiesLenRef = useRef(privateLobbies.length);
    const extraPublicLenRef = useRef(0);
    const extraPrivateLenRef = useRef(0);
    const joinedLobbiesRef = useRef(joinedLobbies);

    useEffect(() => { publicLobbiesLenRef.current = publicLobbies.length; }, [publicLobbies.length]);
    useEffect(() => { privateLobbiesLenRef.current = privateLobbies.length; }, [privateLobbies.length]);
    useEffect(() => { extraPublicLenRef.current = extraPublicLobbies.length; }, [extraPublicLobbies.length]);
    useEffect(() => { extraPrivateLenRef.current = extraPrivateLobbies.length; }, [extraPrivateLobbies.length]);
    useEffect(() => { joinedLobbiesRef.current = joinedLobbies; }, [joinedLobbies]);

    useScrollLock(showCreateModal);

    useEffect(() => {
        if (!isTagDropdownOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
                setIsTagDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isTagDropdownOpen]);

    const publicSentinelRef = useRef<HTMLDivElement | null>(null);
    const privateSentinelRef = useRef<HTMLDivElement | null>(null);
    // Scroll containers for the horizontally-scrolling rows. These are used
    // as the IntersectionObserver `root` below — without this, the observer
    // defaults to the browser viewport, which is why "load more" wasn't
    // reliably firing: the sentinel could sit fully inside the visible
    // viewport (just scrolled out of the row's own clipped area) and never
    // register as "not intersecting" first, so it never triggered a
    // transition into view.
    const publicScrollRef = useRef<HTMLDivElement | null>(null);
    const privateScrollRef = useRef<HTMLDivElement | null>(null);
    const tagDropdownRef = useRef<HTMLDivElement | null>(null);

    const fetchLobbies = useCallback(async (targetGroup?: 'public' | 'private' | 'joined', loadMore = false) => {
        let currentSize = 0;
        if (targetGroup === 'public') currentSize = publicLobbiesLenRef.current + extraPublicLenRef.current;
        else if (targetGroup === 'private') currentSize = privateLobbiesLenRef.current + extraPrivateLenRef.current;

        const from = loadMore ? currentSize : 0;
        const to = from + PAGE_SIZE - 1;

        if (loadMore) {
            if (targetGroup === 'public') { setIsLoadingMorePublic(true); isLoadingMorePublicRef.current = true; }
            else if (targetGroup === 'private') { setIsLoadingMorePrivate(true); isLoadingMorePrivateRef.current = true; }
        } else {
            if (targetGroup === 'public') { setPublicLobbies([]); setExtraPublicLobbies([]); }
            if (targetGroup === 'private') { setPrivateLobbies([]); setExtraPrivateLobbies([]); }
            if (!targetGroup) { setIsLoading(true); setExtraPublicLobbies([]); setExtraPrivateLobbies([]); }
        }

        try {
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
                freshJoinedIds = joinedLobbiesRef.current.map(l => l.id);
            }

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
                    .not('status', 'in', '("finished","closed")')
                    .order('created_at', { ascending: false })
                    .range(from, to);

                if (freshJoinedIds.length > 0) {
                    query = query.not('id', 'in', `(${freshJoinedIds.join(',')})`);
                }

                const { data, error } = await query;
                if (error) throw error;

                const lobbyIds = data?.map(l => l.id) || [];
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

                return data?.map(l => ({
                    ...l,
                    host_profile: (l as any).profiles,
                    is_participant: false,
                    participant_count: participantCounts[l.id] || 0
                })) || [];
            };

            if (fetchPublic) {
                const results = await fetchShared(false);
                if (loadMore) {
                    setExtraPublicLobbies(prev => {
                        const existingIds = new Set([...(publicLobbiesLenRef.current ? publicLobbies : []), ...prev].map(l => l.id));
                        return [...prev, ...results.filter(r => !existingIds.has(r.id))];
                    });
                } else {
                    setPublicLobbies(results);
                }
                setHasMorePublic(results.length === PAGE_SIZE);
            }

            if (fetchPrivate) {
                const results = await fetchShared(true);
                if (loadMore) {
                    setExtraPrivateLobbies(prev => {
                        const existingIds = new Set([...(privateLobbiesLenRef.current ? privateLobbies : []), ...prev].map(l => l.id));
                        return [...prev, ...results.filter(r => !existingIds.has(r.id))];
                    });
                } else {
                    setPrivateLobbies(results);
                }
                setHasMorePrivate(results.length === PAGE_SIZE);
            }

        } catch (error: any) {
            console.error('Error fetching lobbies:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMorePublic(false);
            setIsLoadingMorePrivate(false);
            isLoadingMorePublicRef.current = false;
            isLoadingMorePrivateRef.current = false;
        }
    }, [effectiveUserId, supabase]);

    useEffect(() => {
        const node = publicSentinelRef.current;
        if (!node || !hasMorePublic) return;
        const observer = new IntersectionObserver(([entry]) => {
            // Check ref directly to avoid dependency loops causing endless triggers
            if (entry.isIntersecting && !isLoadingMorePublicRef.current) {
                fetchLobbies('public', true);
            }
        }, { root: publicScrollRef.current, rootMargin: '0px 150px 0px 0px', threshold: 0.01 });
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMorePublic, fetchLobbies]);

    useEffect(() => {
        const node = privateSentinelRef.current;
        if (!node || !hasMorePrivate) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !isLoadingMorePrivateRef.current) {
                fetchLobbies('private', true);
            }
        }, { root: privateScrollRef.current, rootMargin: '0px 150px 0px 0px', threshold: 0.01 });
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMorePrivate, fetchLobbies]);

    const fetchLobbiesRef = useRef(fetchLobbies);
    useEffect(() => { fetchLobbiesRef.current = fetchLobbies; }, [fetchLobbies]);

    // Fallback trigger: some browsers handle IntersectionObserver inconsistently
    // inside CSS scroll-snap containers. A plain scroll-position check is a
    // reliable backstop so "load more" always fires once the user gets near
    // the end of the row, regardless of observer quirks.
    const handlePublicScroll = useCallback(() => {
        const el = publicScrollRef.current;
        if (!el || !hasMorePublic || isLoadingMorePublicRef.current) return;
        if (el.scrollWidth - el.scrollLeft - el.clientWidth < 250) {
            fetchLobbiesRef.current('public', true);
        }
    }, [hasMorePublic]);

    const handlePrivateScroll = useCallback(() => {
        const el = privateScrollRef.current;
        if (!el || !hasMorePrivate || isLoadingMorePrivateRef.current) return;
        if (el.scrollWidth - el.scrollLeft - el.clientWidth < 250) {
            fetchLobbiesRef.current('private', true);
        }
    }, [hasMorePrivate]);

    useEffect(() => {
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
                        setJoinedLobbies(prev => prev.filter(l => l.id !== deletedId));
                        setPublicLobbies(prev => prev.filter(l => l.id !== deletedId));
                        setExtraPublicLobbies(prev => prev.filter(l => l.id !== deletedId));
                        setPrivateLobbies(prev => prev.filter(l => l.id !== deletedId));
                        setExtraPrivateLobbies(prev => prev.filter(l => l.id !== deletedId));
                    }
                }
                fetchLobbiesRef.current();
            })
            .subscribe();

        const participantChannel = supabase
            .channel('participants_list_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tod_participants'
            }, (payload) => {
                const oldRow = payload.old as { lobby_id?: string; user_id?: string } | null;
                const newRow = payload.new as { lobby_id?: string; user_id?: string; status?: string } | null;
                const uid = effectiveUserId;

                if (uid) {
                    if (payload.eventType === 'DELETE' && oldRow?.user_id === uid && oldRow.lobby_id) {
                        setJoinedLobbies(prev => prev.filter(l => l.id !== oldRow.lobby_id));
                    } else if (
                        payload.eventType === 'UPDATE' &&
                        newRow?.user_id === uid &&
                        newRow.status &&
                        !['joined', 'pending'].includes(newRow.status) &&
                        newRow.lobby_id
                    ) {
                        setJoinedLobbies(prev => prev.filter(l => l.id !== newRow.lobby_id));
                    }
                }

                fetchLobbiesRef.current();
            })
            .subscribe();

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchLobbiesRef.current();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            supabase.removeChannel(lobbyChannel);
            supabase.removeChannel(participantChannel);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [supabase]); 

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
    const sortedPublic = useMemo(() => {
        const sorted = sortGroup(publicLobbies);
        if (selectedTag === 'All') return sorted;
        return sorted.filter(l => (l.category || 'Casual') === selectedTag);
    }, [publicLobbies, selectedTag]);

    const sortedExtraPublic = useMemo(() => {
        if (selectedTag === 'All') return extraPublicLobbies;
        return extraPublicLobbies.filter(l => (l.category || 'Casual') === selectedTag);
    }, [extraPublicLobbies, selectedTag]);

    const sortedPrivate = useMemo(() => {
        const sorted = sortGroup(privateLobbies);
        if (selectedTag === 'All') return sorted;
        return sorted.filter(l => (l.category || 'Casual') === selectedTag);
    }, [privateLobbies, selectedTag]);

    const sortedExtraPrivate = useMemo(() => {
        if (selectedTag === 'All') return extraPrivateLobbies;
        return extraPrivateLobbies.filter(l => (l.category || 'Casual') === selectedTag);
    }, [extraPrivateLobbies, selectedTag]);

    const createNewLobby = async () => {
        if (!profile?.id) return;
        if (!lobbyName.trim()) {
            toast.error("Please enter a lobby name");
            return;
        }

        setIsCreating(true);
        try {
            const maxLobbies = isPro ? 5 : 3;
            const { count, error: countError } = await supabase
                .from('tod_lobbies')
                .select('id', { count: 'exact', head: true })
                .eq('host_id', profile.id);
            if (countError) throw countError;

            if ((count ?? 0) >= maxLobbies) {
                const { getUserLobbies } = await import('@/actions/tod-xp');
                const lobbies = await getUserLobbies();
                setUserLobbies(lobbies);
                setPendingCreateAfterDelete(true);
                setShowLimitModal(true);
                setIsCreating(false);
                return;
            }

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

            toast.success('Lobby created!');
            setShowCreateModal(false);
            setNewlyCreatedLobby({ slug: lobby.slug || lobby.id, id: lobby.id, name: lobby.name });
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

        if (lobby.status === 'closed') {
            toast.error('This lobby is closed 🔒');
            return;
        }
        setJoiningLobbyId(lobby.id);
        
        try {
            const { joinLobbyAction } = await import('@/actions/tod-xp');
            const result = await joinLobbyAction(lobby.id, lobby.is_private || false);

            if (!result.success) {
                toast.error(result.message || 'Failed to join lobby');
                setJoiningLobbyId(null);
                return;
            }

            const status = result.status;
            if (status === 'joined') {
                router.push(`/tod/${lobby.slug || lobby.id}`);
            } else if (status === 'pending') {
                toast.success('Request sent! Waiting for host approval ⏳');
                fetchLobbies(); 
                setJoiningLobbyId(null);
            } else if (status === 'rejected') {
                toast.error('Your request to join this lobby was rejected 😔');
                setJoiningLobbyId(null);
            } else if (status === 'banned') {
                toast.error('You have been banned from this lobby 🚫');
                setJoiningLobbyId(null);
            } else {
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
            case 'closed':
                return (
                    <div className="px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                        <Lock size={10} />
                        Closed
                    </div>
                );
            default:
                return null;
        }
    };

    const renderLobbyCard = (lobby: Lobby, variant: 'default' | 'private' | 'joined' = 'default') => {
        const isJoined = variant === 'joined';
        const isPrivateCard = variant === 'private';

        const borderClass = isJoined
            ? 'border-green-500/30 hover:border-green-500/60 bg-gradient-to-br from-slate-900/80 to-slate-900/40'
            : isPrivateCard
                ? 'border-amber-500/20 hover:border-amber-500/50 bg-slate-900/40'
                : 'border-slate-800/80 hover:border-red-500/40 bg-slate-900/60';
                
        return (
            <div
                key={lobby.id}
                onClick={() => !joiningLobbyId && setConfirmLobby(lobby)}
                className={`group relative overflow-hidden flex flex-col justify-between p-4 rounded-3xl transition-all cursor-pointer border snap-center w-[220px] shrink-0 h-[160px] ${borderClass} ${joiningLobbyId === lobby.id ? 'ring-2 ring-red-500' : ''}`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-white font-bold text-sm truncate group-hover:text-red-400 transition-colors leading-tight">
                            {lobby.name || 'Game Lobby'}
                        </h3>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            by <span className="text-slate-400 font-semibold">{lobby.host_profile?.username || 'Host'}</span>
                        </p>
                    </div>
                    {getStatusBadge(lobby.status)}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-800/80 text-[9px] font-black uppercase text-slate-500 tracking-wider">
                        {lobby.category || 'Casual'}
                    </span>
                    {lobby.is_private && lobby.status !== 'closed' && <Lock size={11} className="text-amber-500 mt-0.5" />}
                    {lobby.status === 'closed' && <ClosedLobbyBadge />}
                    {isJoined && (
                        <span className="px-2 py-0.5 rounded-lg bg-green-500/10 border border-green-500/20 text-[9px] font-black uppercase text-green-400 tracking-wider">
                            {lobby.user_status === 'pending' ? 'Pending' : 'Joined'}
                        </span>
                    )}
                </div>

                <div className="mt-auto pt-3 border-t border-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <Users size={11} />
                        <span>{lobby.participant_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-500 group-hover:text-red-400 transition-colors font-bold text-[10px]">
                        <span>{lobby.user_status === 'joined' ? 'Rejoin' : lobby.user_status === 'pending' ? 'View' : 'Join'}</span>
                        <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>

                {joiningLobbyId === lobby.id && (
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="animate-spin text-red-500" size={24} />
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

                    {/* Tag Filter Dropdown */}
                    <div className="mt-6 relative inline-block" ref={tagDropdownRef}>
                        <button
                            onClick={() => setIsTagDropdownOpen(prev => !prev)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider border bg-slate-900/60 border-slate-800/60 text-slate-300 hover:border-slate-700 transition-all active:scale-95"
                        >
                            <Filter size={13} className={selectedTag !== 'All' ? 'text-red-500' : 'text-slate-500'} />
                            <span>{selectedTag === 'All' ? 'All Tags' : selectedTag}</span>
                            <ChevronDown size={14} className={`text-slate-500 transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isTagDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 z-50 min-w-[160px] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                {['All', ...CATEGORIES].map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => {
                                            setSelectedTag(tag);
                                            setIsTagDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-3 text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-between ${
                                            selectedTag === tag
                                                ? 'bg-red-500/10 text-red-400'
                                                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                                        }`}
                                    >
                                        <span>{tag === 'All' ? '🏷️ All Tags' : tag}</span>
                                        {selectedTag === tag && <Check size={13} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-10">
                        {/* 1. My Lobbies */}
                        {sortedJoined.length > 0 && (
                            <section>
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h2 className="text-base font-black text-white flex items-center gap-2.5 uppercase tracking-widest">
                                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse" />
                                        My Lobbies
                                    </h2>
                                    <span className="text-[10px] font-black text-green-500 uppercase tracking-widest bg-green-500/5 px-3 py-1.5 rounded-full border border-green-500/20">
                                        {sortedJoined.length} Active
                                    </span>
                                </div>
                                <div className="flex overflow-x-auto pb-3 gap-3 snap-x snap-mandatory no-scrollbar -mx-4 px-4">
                                    {sortedJoined.map(lobby => renderLobbyCard(lobby, 'joined'))}
                                </div>
                            </section>
                        )}

                        {/* 2. Private Lobbies */}
                        <section>
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h2 className="text-base font-black text-white flex items-center gap-2.5 uppercase tracking-widest">
                                    <Lock size={16} className="text-amber-500" />
                                    Private Lobbies
                                </h2>
                                <button
                                    onClick={() => fetchLobbies('private')}
                                    className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/5 px-3 py-1.5 rounded-full border border-amber-500/20 hover:bg-amber-500/10 transition-colors"
                                >
                                    Refresh
                                </button>
                            </div>

                            {sortedPrivate.length > 0 ? (
                                <div ref={privateScrollRef} onScroll={handlePrivateScroll} className="flex overflow-x-auto pb-3 gap-3 snap-x snap-mandatory no-scrollbar -mx-4 px-4">
                                    {sortedPrivate.map(lobby => renderLobbyCard(lobby, 'private'))}
                                    {sortedExtraPrivate.map(lobby => renderLobbyCard(lobby, 'private'))}

                                    {hasMorePrivate && (
                                        <div
                                            ref={privateSentinelRef}
                                            className="snap-center shrink-0 w-[90px] h-[160px] flex items-center justify-center text-amber-500/60"
                                            aria-label="Loading more private lobbies"
                                        >
                                            {isLoadingMorePrivateRef.current ? <Loader2 size={22} className="animate-spin" /> : <div className="w-4 h-4 rounded-full bg-amber-500/20" />}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="py-8 text-center bg-slate-900/30 rounded-[2rem] border border-dashed border-slate-800/50">
                                    <p className="text-slate-600 text-sm italic">No private lobbies found</p>
                                </div>
                            )}
                        </section>

                        {/* 3. Public Lobbies */}
                        <section>
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h2 className="text-base font-black text-white flex items-center gap-2.5 uppercase tracking-widest">
                                    <Play size={16} className="text-red-500" />
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
                                <div ref={publicScrollRef} onScroll={handlePublicScroll} className="flex overflow-x-auto pb-3 gap-3 snap-x snap-mandatory no-scrollbar -mx-4 px-4">
                                    {sortedPublic.map(lobby => renderLobbyCard(lobby, 'default'))}
                                    {sortedExtraPublic.map(lobby => renderLobbyCard(lobby, 'default'))}

                                    {hasMorePublic && (
                                        <div
                                            ref={publicSentinelRef}
                                            className="snap-center shrink-0 w-[90px] h-[160px] flex items-center justify-center text-slate-500"
                                            aria-label="Loading more public lobbies"
                                        >
                                            {isLoadingMorePublicRef.current ? <Loader2 size={22} className="animate-spin" /> : <div className="w-4 h-4 rounded-full bg-slate-500/20" />}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="py-12 text-center bg-slate-900/30 rounded-[2rem] border border-dashed border-slate-800/50">
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
                                        Private lobbies require host approval for players to join.
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

            {/* Lobby Limit Modal */}
            {showLimitModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setShowLimitModal(false); setPendingCreateAfterDelete(false); }} />
                    <div className="relative bg-[#0f0f1a] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-white">Lobby Limit Reached</h3>
                                <p className="text-xs text-slate-500 mt-1">Delete a lobby to create a new one</p>
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
                                <Play size={22} className="text-orange-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-1">
                                {confirmLobby.user_status === 'joined' ? 'Rejoin Lobby?' : confirmLobby.user_status === 'pending' ? 'View Request?' : 'Enter Lobby?'}
                            </h3>
                            <p className="text-slate-500 text-sm mb-1">
                                <span className="font-bold text-white">{confirmLobby.name || 'Game Lobby'}</span>
                            </p>
                            <p className="text-slate-600 text-xs">
                                by {confirmLobby.host_profile?.username || 'Host'} · {confirmLobby.category || 'Casual'}
                                {confirmLobby.is_private && ' · Private (host approval required)'}
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
                                onClick={async () => {
                                    const lobby = confirmLobby;
                                    setConfirmLobby(null);
                                    if (lobby) await joinLobby(lobby);
                                }}
                                disabled={!!joiningLobbyId}
                                className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {joiningLobbyId ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                                {confirmLobby.user_status === 'joined' ? 'Rejoin' : 'Enter'}
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
                            {/* Celebration header */}
                            <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center mb-1">
                                    <Sparkles size={28} className="text-orange-400" />
                                </div>
                                <h3 className="text-2xl font-black text-white italic tracking-tight">Lobby Created! 🎉</h3>
                                <p className="text-slate-400 text-sm">
                                    <span className="font-bold text-white">{newlyCreatedLobby.name}</span> is ready to go.<br />
                                    Invite your friends to join the fun!
                                </p>
                            </div>

                            {/* Copyable link */}
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

                            {/* Action buttons */}
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
