// src/components/tod/hooks/useGameLogic.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: string;
  lobby_id: string;
  user_id: string;
  content: string;
  image_url?: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system';
  created_at: string;
  profiles?: { username: string };
  isOptimistic?: boolean;
  isSent?: boolean;
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
  const channelRef = useRef<any>(null);
  const pollIntervalRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  const fetchParticipants = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined') return;
    try {
      const { data, error } = await supabase
        .from('tod_participants')
        .select('user_id, has_gone_this_round, profiles(username)')
        .eq('lobby_id', lobbyId);
      if (!error && isMounted.current) setParticipants(data || []);
    } catch (err) {
      console.error('Error fetching participants:', err);
    }
  }, [lobbyId, supabase]);

  const fetchMessages = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined') return;
    try {
      const { data, error } = await supabase
        .from('tod_messages')
        .select('*, profiles(username)')
        .eq('lobby_id', lobbyId)
        .order('created_at', { ascending: true });
      
      if (!error && isMounted.current) {
        setMessages(prev => {
          const optimisticMsgs = prev.filter(m => m.isOptimistic);
          const realMessages = (data || []).map(msg => ({ ...msg, isSent: true }));
          
          const filteredOptimistic = optimisticMsgs.filter(opt =>
            !realMessages.some(real =>
              real.content === opt.content &&
              real.user_id === opt.user_id &&
              Math.abs(new Date(real.created_at).getTime() - new Date(opt.created_at).getTime()) < 5000
            )
          );
          
          return [...realMessages, ...filteredOptimistic].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, [lobbyId, supabase]);

  const fetchInitialData = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined') {
      setErrorStatus('Invalid Lobby ID.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tod_lobbies')
        .select('*')
        .eq('id', lobbyId)
        .single();
      if (error) throw error;
      if (isMounted.current) {
        setLobby(data);
        await fetchParticipants();
        await fetchMessages();
      }
    } catch (err: any) {
      if (isMounted.current) setErrorStatus(err.message);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [lobbyId, supabase, fetchParticipants, fetchMessages]);

  // Timer logic
  useEffect(() => {
    if (!lobby || lobby.status !== 'active' || !lobby.turn_started_at) {
      setTimeRemaining(null);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    const updateTimer = () => {
      const turnStarted = new Date(lobby.turn_started_at!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - turnStarted) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      
      setTimeRemaining(remaining);

      // Auto-skip if time runs out and we're the host
      if (remaining === 0 && lobby.host_id === userId) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        // Auto-skip to next round
        setTimeout(() => {
          startNextRound();
        }, 1000);
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [lobby?.turn_started_at, lobby?.status, lobby?.host_id, userId]);

  const addOptimisticMessage = useCallback((message: Partial<Message>) => {
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      lobby_id: lobbyId,
      user_id: userId || '',
      content: message.content || '',
      image_url: message.image_url,
      message_type: message.message_type || 'chat',
      created_at: new Date().toISOString(),
      profiles: message.profiles,
      isOptimistic: true,
      isSent: false
    };
    setMessages(prev => [...prev, optimisticMsg]);
    return optimisticMsg.id;
  }, [lobbyId, userId]);

  const markMessageAsSent = useCallback((tempId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === tempId ? { ...m, isSent: true } : m
    ));
  }, []);

  const removeOptimisticMessage = useCallback((tempId: string) => {
    setMessages(prev => prev.filter(m => m.id !== tempId));
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    imageUrl: string | null,
    messageType: 'chat' | 'truth' | 'dare' | 'system',
    username?: string
  ) => {
    const tempId = addOptimisticMessage({
      content: content || '📷 Photo',
      image_url: imageUrl || undefined,
      message_type: messageType,
      profiles: { username: username || 'You' }
    });

    try {
      const { error } = await supabase.from('tod_messages').insert({
        lobby_id: lobbyId,
        user_id: userId,
        content: content || '📷 Photo',
        image_url: imageUrl,
        message_type: messageType
      });

      if (error) throw error;
      markMessageAsSent(tempId);
      
      if (messageType === 'truth' || messageType === 'dare') {
        await supabase.from('tod_lobbies').update({
          current_question: content
        }).eq('id', lobbyId);
      }
      
      return true;
    } catch (err) {
      removeOptimisticMessage(tempId);
      toast.error('Failed to send message');
      return false;
    }
  }, [lobbyId, userId, supabase, addOptimisticMessage, markMessageAsSent, removeOptimisticMessage]);

  const selectMode = useCallback(async (mode: 'truth' | 'dare', username?: string) => {
    try {
      const { error } = await supabase
        .from('tod_lobbies')
        .update({ selected_mode: mode })
        .eq('id', lobbyId);
      
      if (error) throw error;

      const targetUser = participants.find(p => p.user_id === lobby?.current_target_id);
      await sendMessage(
        `${targetUser?.profiles?.username || 'Player'} chose ${mode.toUpperCase()}! 🎲`,
        null,
        'system',
        username
      );

      const { data } = await supabase
        .from('tod_lobbies')
        .select('*')
        .eq('id', lobbyId)
        .single();
      if (data) setLobby(data);
      
      return true;
    } catch (err) {
      toast.error('Failed to select mode');
      return false;
    }
  }, [lobbyId, supabase, lobby, participants, sendMessage]);

  const startGame = useCallback(async () => {
    try {
      console.log('Starting game for lobby:', lobbyId);
      
      const { data: rpcData, error: rpcError } = await supabase.rpc('next_tod_turn', { 
        lobby_uuid: lobbyId 
      });
      
      console.log('RPC result:', { rpcData, rpcError });
      
      if (rpcError) {
        console.error('RPC Error:', rpcError);
        throw rpcError;
      }

      await supabase.from('tod_messages').insert({
        lobby_id: lobbyId,
        user_id: userId,
        content: '🎮 Game started! Let the fun begin!',
        message_type: 'system'
      });

      await fetchInitialData();
      
      toast.success('Game started! 🎉');
      return true;
    } catch (err: any) {
      console.error('Start game error:', err);
      toast.error('Failed to start game: ' + err.message);
      return false;
    }
  }, [lobbyId, userId, supabase, fetchInitialData]);

  const startNextRound = useCallback(async () => {
    try {
      console.log('Starting next round for lobby:', lobbyId);
      
      const { data: rpcData, error: rpcError } = await supabase.rpc('next_tod_turn', { 
        lobby_uuid: lobbyId 
      });
      
      console.log('Next round RPC result:', { rpcData, rpcError });
      
      if (rpcError) {
        console.error('RPC Error:', rpcError);
        throw rpcError;
      }

      await supabase.from('tod_messages').insert({
        lobby_id: lobbyId,
        user_id: userId,
        content: '🎯 New round started!',
        message_type: 'system'
      });

      await fetchInitialData();
      toast.success('Next round started! 🎲');
      return true;
    } catch (err: any) {
      console.error('Next round error:', err);
      toast.error('Failed to start next round: ' + err.message);
      return false;
    }
  }, [lobbyId, userId, supabase, fetchInitialData]);

  const endGame = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('tod_lobbies')
        .update({ status: 'finished' })
        .eq('id', lobbyId);
      
      if (error) throw error;

      await supabase.from('tod_messages').insert({
        lobby_id: lobbyId,
        user_id: userId,
        content: '🏁 Game ended! Thanks for playing!',
        message_type: 'system'
      });

      await fetchInitialData();
      toast.success('Game ended!');
      return true;
    } catch (err) {
      toast.error('Failed to end game');
      return false;
    }
  }, [lobbyId, userId, supabase, fetchInitialData]);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${lobbyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tod-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('tod-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      toast.error('Failed to upload image');
      return null;
    }
  }, [lobbyId, supabase]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up game logic...');
    isMounted.current = false;
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, [supabase]);

  useEffect(() => {
    isMounted.current = true;
    fetchInitialData();

    channelRef.current = supabase.channel(`tod_realtime_${lobbyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tod_lobbies',
        filter: `id=eq.${lobbyId}`
      }, (payload) => {
        console.log('Lobby update:', payload);
        if (payload.new && isMounted.current) setLobby(payload.new as Lobby);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tod_participants',
        filter: `lobby_id=eq.${lobbyId}`
      }, () => {
        if (isMounted.current) fetchParticipants();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tod_messages',
        filter: `lobby_id=eq.${lobbyId}`
      }, () => {
        if (isMounted.current) fetchMessages();
      })
      .subscribe();

    pollIntervalRef.current = setInterval(() => {
      if (isMounted.current) {
        fetchMessages();
        fetchParticipants();
      }
    }, 3000);

    return cleanup;
  }, [lobbyId, fetchInitialData, fetchParticipants, fetchMessages, supabase, cleanup]);

  return {
    lobby,
    participants,
    messages,
    isLoading,
    errorStatus,
    timeRemaining,
    sendMessage,
    selectMode,
    startGame,
    startNextRound,
    endGame,
    uploadImage,
    refetch: fetchInitialData,
    cleanup
  };
};
