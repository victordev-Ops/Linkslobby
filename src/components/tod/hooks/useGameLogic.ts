// src/components/tod/hooks/useGameLogic.ts
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
  
  const channelRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined') return;
    try {
      const [lobbyRes, partsRes, msgsRes] = await Promise.all([
        supabase.from('tod_lobbies').select('*').eq('id', lobbyId).single(),
        supabase.from('tod_participants').select('*, profiles(username)').eq('lobby_id', lobbyId),
        supabase.from('tod_messages').select('*, profiles(username)').eq('lobby_id', lobbyId).order('created_at', { ascending: true })
      ]);

      if (lobbyRes.error) throw lobbyRes.error;
      
      setLobby(lobbyRes.data);
      setParticipants(partsRes.data || []);
      setMessages((msgsRes.data || []).map(m => ({ ...m, status: 'sent' })));
      setIsLoading(false);
    } catch (err) {
      setErrorStatus('Failed to load game');
      setIsLoading(false);
    }
  }, [lobbyId, supabase]);

  const startNextRound = useCallback(async () => {
    const { error } = await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
    if (error) {
      console.error("RPC Error:", error);
      toast.error("Failed to cycle turn");
    }
  }, [lobbyId, supabase]);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [supabase]);

  useEffect(() => {
    if (!lobbyId || lobbyId === 'undefined') return;

    const channel = supabase.channel(`game:${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tod_lobbies', filter: `id=eq.${lobbyId}` }, 
        (p) => setLobby(prev => ({ ...prev, ...p.new } as Lobby))
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tod_messages', filter: `lobby_id=eq.${lobbyId}` }, 
        (p) => setMessages(prev => prev.some(m => m.id === p.new.id) ? prev : [...prev, { ...p.new, status: 'sent' } as Message])
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tod_participants', filter: `lobby_id=eq.${lobbyId}` }, 
        () => fetchData()
      )
      .subscribe();

    channelRef.current = channel;
    fetchData();

    return () => cleanup();
  }, [lobbyId, supabase, fetchData, cleanup]);

  // Timer & Auto-Cycle
  useEffect(() => {
    if (!lobby || lobby.status !== 'active' || !lobby.turn_started_at) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(lobby.turn_started_at!).getTime()) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0 && userId === lobby.host_id) {
        startNextRound();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lobby?.turn_started_at, lobby?.status, lobby?.host_id, userId, startNextRound]);

  const sendMessage = useCallback(async (
    content: string, 
    imageUrl: string | null, 
    messageType: 'chat' | 'truth' | 'dare' | 'system', 
    username?: string
  ) => {
    if (!userId || !lobby) return;

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { 
      id: tempId, lobby_id: lobbyId, user_id: userId, content, image_url: imageUrl || undefined,
      message_type: messageType, created_at: new Date().toISOString(), status: 'sending', profiles: { username: username || 'You' }
    }]);

    try {
      const { error } = await supabase.from('tod_messages').insert({
        lobby_id: lobbyId, user_id: userId, content, image_url: imageUrl, message_type: messageType
      });
      if (error) throw error;

      // Logic: If the Target answered, move to next round after 3 seconds
      if (lobby.current_question && userId === lobby.current_target_id) {
        setTimeout(startNextRound, 3000);
      }
    } catch (err) {
      toast.error("Message failed to send");
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }, [lobbyId, userId, lobby, supabase, startNextRound]);

  return {
    lobby, 
    participants, 
    messages, 
    isLoading, 
    errorStatus, // Added back for TypeScript
    timeRemaining,
    sendMessage, 
    selectMode: (mode: 'truth' | 'dare') => supabase.from('tod_lobbies').update({ selected_mode: mode }).eq('id', lobbyId),
    startGame: startNextRound,
    startNextRound,
    endGame: () => supabase.from('tod_lobbies').update({ status: 'finished' }).eq('id', lobbyId),
    uploadImage: async (file: File) => {
      const path = `${lobbyId}/${Date.now()}-${file.name}`;
      await supabase.storage.from('tod-images').upload(path, file);
      return supabase.storage.from('tod-images').getPublicUrl(path).data.publicUrl;
    },
    cleanup // Added back for TypeScript
  };
};
