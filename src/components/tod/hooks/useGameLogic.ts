import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface Message {
  id: string;
  lobby_id: string;
  user_id: string;
  content: string;
  image_url?: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system';
  created_at: string;
  profiles?: { username: string };
  status: 'sending' | 'sent' | 'error';
}

interface Participant {
  user_id: string;
  has_gone_this_round: boolean;
  profiles?: { username: string };
}

interface Lobby {
  id: string;
  host_id: string;
  status: 'waiting' | 'active' | 'finished';
  current_asker_id?: string;
  current_target_id?: string;
  selected_mode?: 'truth' | 'dare';
  current_question?: string;
  turn_started_at?: string;
}

export const useGameLogic = (lobbyId: string, userId?: string) => {
  const [supabase] = useState(() => createClient());
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined') return;
    try {
      const [lobbyRes, partsRes, msgsRes] = await Promise.all([
        supabase.from('tod_lobbies').select('*').eq('id', lobbyId).single(),
        supabase.from('tod_participants').select('*, profiles(username)').eq('lobby_id', lobbyId),
        supabase.from('tod_messages').select('*, profiles(username)').eq('lobby_id', lobbyId).order('created_at', { ascending: true })
      ]);

      if (lobbyRes.data) setLobby(lobbyRes.data);
      if (partsRes.data) setParticipants(partsRes.data);
      if (msgsRes.data) {
        setMessages(msgsRes.data.map(m => ({ ...m, status: 'sent' })));
      }
      setIsLoading(false);
    } catch (err) {
      setErrorStatus('Failed to load game');
      setIsLoading(false);
    }
  }, [lobbyId, supabase]);

  useEffect(() => {
    if (!lobbyId || lobbyId === 'undefined') return;
    isMounted.current = true;

    const channel = supabase
      .channel(`game:${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tod_lobbies', filter: `id=eq.${lobbyId}` }, 
        (payload) => setLobby(prev => ({ ...prev, ...payload.new } as Lobby))
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tod_messages', filter: `lobby_id=eq.${lobbyId}` }, 
        (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, { ...payload.new, status: 'sent' } as Message];
          });
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tod_participants', filter: `lobby_id=eq.${lobbyId}` }, 
        () => fetchData()
      )
      .subscribe();

    fetchData();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [lobbyId, supabase, fetchData]);

  useEffect(() => {
    if (!lobby || lobby.status !== 'active' || !lobby.turn_started_at) {
      setTimeRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(lobby.turn_started_at!).getTime()) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimeRemaining(remaining);
      if (remaining === 0 && lobby.host_id === userId) {
        supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lobby?.turn_started_at, lobby?.status, lobbyId, userId, supabase]);

  const sendMessage = useCallback(async (
    content: string, 
    imageUrl: string | null, 
    messageType: 'chat' | 'truth' | 'dare' | 'system', 
    username?: string
  ) => {
    if (!userId) return;
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId, lobby_id: lobbyId, user_id: userId, content, image_url: imageUrl || undefined,
      message_type: messageType, created_at: new Date().toISOString(), status: 'sending', profiles: { username: username || 'You' }
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data, error } = await supabase.from('tod_messages').insert({
        lobby_id: lobbyId, user_id: userId, content, image_url: imageUrl, message_type: messageType
      }).select().single();
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, status: 'sent' } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
    }
  }, [lobbyId, userId, supabase]);

  const selectMode = async (mode: 'truth' | 'dare') => {
    await supabase.from('tod_lobbies').update({ selected_mode: mode }).eq('id', lobbyId);
  };

  const startGame = async () => {
    await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
  };

  const startNextRound = async () => {
    await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
  };

  const endGame = async () => {
    await supabase.from('tod_lobbies').update({ status: 'finished' }).eq('id', lobbyId);
  };

  const uploadImage = async (file: File) => {
    const filePath = `${lobbyId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('tod-images').upload(filePath, file);
    if (error) return null;
    return supabase.storage.from('tod-images').getPublicUrl(filePath).data.publicUrl;
  };

  return {
    lobby, participants, messages, isLoading, errorStatus, timeRemaining,
    sendMessage, selectMode, startGame, startNextRound, endGame, uploadImage,
    cleanup: () => {}
  };
};
