import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ... (Interfaces remain the same)

export const useGameLogic = (lobbyId: string, userId?: string) => {
  const [supabase] = useState(() => createClient());
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined') return;
    const [lobbyRes, partsRes, msgsRes] = await Promise.all([
      supabase.from('tod_lobbies').select('*').eq('id', lobbyId).single(),
      supabase.from('tod_participants').select('*, profiles(username)').eq('lobby_id', lobbyId),
      supabase.from('tod_messages').select('*, profiles(username)').eq('lobby_id', lobbyId).order('created_at', { ascending: true })
    ]);

    if (lobbyRes.data) setLobby(lobbyRes.data);
    if (partsRes.data) setParticipants(partsRes.data);
    if (msgsRes.data) setMessages(msgsRes.data.map(m => ({ ...m, status: 'sent' })));
    setIsLoading(false);
  }, [lobbyId, supabase]);

  // Realtime
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
    fetchData();
    return () => { supabase.removeChannel(channel); };
  }, [lobbyId, supabase, fetchData]);

  // Auto-Cycle Logic (Timer)
  useEffect(() => {
    if (!lobby || lobby.status !== 'active' || !lobby.turn_started_at) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(lobby.turn_started_at!).getTime()) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimeRemaining(remaining);

      // Only Host triggers the RPC on timeout to prevent duplicate calls
      if (remaining === 0 && userId === lobby.host_id) {
        startNextRound();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lobby?.turn_started_at, lobby?.status, userId]);

  const startNextRound = async () => {
    const { error } = await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
    if (error) toast.error("Failed to cycle turn");
  };

  const sendMessage = useCallback(async (
    content: string, 
    imageUrl: string | null, 
    messageType: 'chat' | 'truth' | 'dare' | 'system', 
    username?: string
  ) => {
    if (!userId || !lobby) return;

    // 1. Optimistic Update
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { 
      id: tempId, lobby_id: lobbyId, user_id: userId, content, image_url: imageUrl || undefined,
      message_type: messageType, created_at: new Date().toISOString(), status: 'sending', profiles: { username: username || 'You' }
    }]);

    try {
      // 2. Insert Message
      const { error } = await supabase.from('tod_messages').insert({
        lobby_id: lobbyId, user_id: userId, content, image_url: imageUrl, message_type: messageType
      });
      if (error) throw error;

      // 3. Logic: If the Target answered, move to next round after 3 seconds
      // We check if there is a current question and the sender is the target
      if (lobby.current_question && userId === lobby.current_target_id && userId === lobby.host_id) {
        setTimeout(startNextRound, 3000);
      } else if (lobby.current_question && userId === lobby.current_target_id) {
         // If sender is target but NOT host, they don't call RPC (Host handles it via effect or button)
         // Alternatively, allow anyone to trigger next round once answered:
         setTimeout(startNextRound, 3000);
      }

    } catch (err) {
      toast.error("Message failed to send");
    }
  }, [lobbyId, userId, lobby, supabase]);

  const selectMode = async (mode: 'truth' | 'dare') => {
    await supabase.from('tod_lobbies').update({ selected_mode: mode }).eq('id', lobbyId);
  };

  const startGame = async () => {
    await startNextRound();
  };

  return {
    lobby, participants, messages, isLoading, timeRemaining,
    sendMessage, selectMode, startGame, startNextRound,
    endGame: () => supabase.from('tod_lobbies').update({ status: 'finished' }).eq('id', lobbyId),
    uploadImage: async (file: File) => {
      const path = `${lobbyId}/${Date.now()}-${file.name}`;
      await supabase.storage.from('tod-images').upload(path, file);
      return supabase.storage.from('tod-images').getPublicUrl(path).data.publicUrl;
    }
  };
};
