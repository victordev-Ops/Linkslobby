// src/components/tod/hooks/useGameLogic.ts
// SIMPLIFIED VERSION - Uses reliable polling instead of flaky realtime

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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLobbyStatus = useRef<string>('');
  const lastParticipantCount = useRef<number>(0);
  const lastMessageCount = useRef<number>(0);

  const fetchData = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined' || !isMounted.current) return;

    try {
      // Fetch all data in parallel
      const [lobbyResult, participantsResult, messagesResult] = await Promise.all([
        supabase.from('tod_lobbies').select('*').eq('id', lobbyId).single(),
        supabase.from('tod_participants').select('user_id, has_gone_this_round, profiles(username)').eq('lobby_id', lobbyId).order('joined_at', { ascending: true }),
        supabase.from('tod_messages').select('*, profiles(username)').eq('lobby_id', lobbyId).order('created_at', { ascending: true })
      ]);

      if (!isMounted.current) return;

      // Update lobby
      if (lobbyResult.data) {
        const newLobby = lobbyResult.data;
        
        // Detect status changes
        if (lastLobbyStatus.current && lastLobbyStatus.current !== newLobby.status) {
          if (newLobby.status === 'active') {
            toast.success('🎮 Game Started!', { duration: 3000 });
          } else if (newLobby.status === 'finished') {
            toast.info('🏁 Game Ended!', { duration: 3000 });
          }
        }
        
        // Detect mode selection
        if (lobby?.status === 'active' && !lobby?.selected_mode && newLobby.selected_mode) {
          toast.info(`${newLobby.selected_mode.toUpperCase()} Selected!`, { duration: 2000 });
        }
        
        // Detect new round
        if (lobby?.current_target_id && newLobby.current_target_id !== lobby?.current_target_id) {
          toast.info('🎯 New Round!', { duration: 2000 });
        }
        
        lastLobbyStatus.current = newLobby.status;
        setLobby(newLobby);
      }

      // Update participants
      if (participantsResult.data) {
        const newCount = participantsResult.data.length;
        
        // Detect new participants
        if (lastParticipantCount.current > 0 && newCount > lastParticipantCount.current) {
          toast.success('👋 New player joined!', { duration: 2000 });
        }
        
        lastParticipantCount.current = newCount;
        setParticipants(participantsResult.data);
      }

      // Update messages
      if (messagesResult.data) {
        const newCount = messagesResult.data.length;
        
        // Clear optimistic messages when we get real ones
        setMessages(prev => {
          const optimistic = prev.filter(m => m.isOptimistic);
          const real = messagesResult.data.map(msg => ({ ...msg, isSent: true }));
          
          const filtered = optimistic.filter(opt =>
            !real.some(r =>
              r.content === opt.content &&
              r.user_id === opt.user_id &&
              Math.abs(new Date(r.created_at).getTime() - new Date(opt.created_at).getTime()) < 5000
            )
          );
          
          return [...real, ...filtered].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
        
        lastMessageCount.current = newCount;
      }

    } catch (err) {
      console.error('❌ Error fetching data:', err);
    }
  }, [lobbyId, supabase, lobby?.status, lobby?.selected_mode, lobby?.current_target_id]);

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

      if (remaining === 0 && lobby.host_id === userId && isMounted.current) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
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
      id: `temp-${Date.now()}-${Math.random()}`,
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
      
      // Immediately fetch to get the real message
      setTimeout(() => fetchData(), 200);
      
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
  }, [lobbyId, userId, supabase, addOptimisticMessage, removeOptimisticMessage, fetchData]);

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

      // Immediately fetch updates
      setTimeout(() => fetchData(), 200);
      
      return true;
    } catch (err) {
      toast.error('Failed to select mode');
      return false;
    }
  }, [lobbyId, supabase, lobby, participants, sendMessage, fetchData]);

  const startGame = useCallback(async () => {
    try {
      const { error: rpcError } = await supabase.rpc('next_tod_turn', { 
        lobby_uuid: lobbyId 
      });
      
      if (rpcError) throw rpcError;

      await supabase.from('tod_messages').insert({
        lobby_id: lobbyId,
        user_id: userId,
        content: '🎮 Game started! Let the fun begin!',
        message_type: 'system'
      });

      // Immediately fetch updates
      setTimeout(() => fetchData(), 200);
      
      return true;
    } catch (err: any) {
      console.error('Start game error:', err);
      toast.error('Failed to start game');
      return false;
    }
  }, [lobbyId, userId, supabase, fetchData]);

  const startNextRound = useCallback(async () => {
    try {
      const { error: rpcError } = await supabase.rpc('next_tod_turn', { 
        lobby_uuid: lobbyId 
      });
      
      if (rpcError) throw rpcError;

      await supabase.from('tod_messages').insert({
        lobby_id: lobbyId,
        user_id: userId,
        content: '🎯 New round started!',
        message_type: 'system'
      });

      // Immediately fetch updates
      setTimeout(() => fetchData(), 200);
      
      return true;
    } catch (err: any) {
      console.error('Next round error:', err);
      toast.error('Failed to start next round');
      return false;
    }
  }, [lobbyId, userId, supabase, fetchData]);

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

      // Immediately fetch updates
      setTimeout(() => fetchData(), 200);
      
      return true;
    } catch (err) {
      toast.error('Failed to end game');
      return false;
    }
  }, [lobbyId, userId, supabase, fetchData]);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
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

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up...');
    isMounted.current = false;
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    if (!lobbyId || lobbyId === 'undefined') {
      setErrorStatus('Invalid Lobby ID.');
      setIsLoading(false);
      return;
    }

    isMounted.current = true;
    
    // Initial fetch
    fetchData().then(() => {
      if (isMounted.current) {
        setIsLoading(false);
      }
    });

    // Poll every 1 second for fast updates
    pollIntervalRef.current = setInterval(() => {
      if (isMounted.current) {
        fetchData();
      }
    }, 1000);

    return cleanup;
  }, [lobbyId, fetchData, cleanup]);

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
    refetch: fetchData,
    cleanup
  };
};
