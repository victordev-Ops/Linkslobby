// src/components/tod/hooks/useGameLogic.ts
// PRODUCTION-READY VERSION with instant realtime updates

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchParticipants = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined' || !isMounted.current) return;

    try {
      const { data, error } = await supabase
        .from('tod_participants')
        .select('user_id, has_gone_this_round, profiles(username)')
        .eq('lobby_id', lobbyId)
        .order('joined_at', { ascending: true });
      
      if (!error && isMounted.current) {
        setParticipants(data || []);
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
    }
  }, [lobbyId, supabase]);

  const fetchMessages = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined' || !isMounted.current) return;

    try {
      const { data, error } = await supabase
        .from('tod_messages')
        .select('*, profiles(username)')
        .eq('lobby_id', lobbyId)
        .order('created_at', { ascending: true });
      
      if (!error && isMounted.current) {
        setMessages(prev => {
          const optimistic = prev.filter(m => m.isOptimistic);
          const real = (data || []).map(msg => ({ ...msg, isSent: true }));
          
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
      const [lobbyResult, participantsResult, messagesResult] = await Promise.all([
        supabase.from('tod_lobbies').select('*').eq('id', lobbyId).single(),
        supabase.from('tod_participants').select('user_id, has_gone_this_round, profiles(username)').eq('lobby_id', lobbyId).order('joined_at', { ascending: true }),
        supabase.from('tod_messages').select('*, profiles(username)').eq('lobby_id', lobbyId).order('created_at', { ascending: true })
      ]);

      if (lobbyResult.error) throw lobbyResult.error;
      
      if (isMounted.current) {
        setLobby(lobbyResult.data);
        setParticipants(participantsResult.data || []);
        setMessages((messagesResult.data || []).map(msg => ({ ...msg, isSent: true })));
      }
    } catch (err: any) {
      if (isMounted.current) setErrorStatus(err.message);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [lobbyId, supabase]);

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
      
      setTimeout(() => removeOptimisticMessage(tempId), 5000);
      
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
  }, [lobbyId, userId, supabase, addOptimisticMessage, removeOptimisticMessage]);

  const selectMode = useCallback(async (mode: 'truth' | 'dare', username?: string) => {
    try {
      // Optimistic update
      setLobby(prev => prev ? { ...prev, selected_mode: mode } : null);

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

      return true;
    } catch (err) {
      toast.error('Failed to select mode');
      await fetchInitialData();
      return false;
    }
  }, [lobbyId, supabase, lobby, participants, sendMessage, fetchInitialData]);

  const startGame = useCallback(async () => {
    try {
      // Optimistic update
      setLobby(prev => prev ? { ...prev, status: 'active' } : null);
      
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

      // Don't refetch - let realtime handle it
      toast.success('Game started! 🎉');
      return true;
    } catch (err: any) {
      console.error('Start game error:', err);
      toast.error('Failed to start game');
      await fetchInitialData();
      return false;
    }
  }, [lobbyId, userId, supabase, fetchInitialData]);

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

      toast.success('Next round started! 🎲');
      return true;
    } catch (err: any) {
      console.error('Next round error:', err);
      toast.error('Failed to start next round');
      return false;
    }
  }, [lobbyId, userId, supabase]);

  const endGame = useCallback(async () => {
    try {
      // Optimistic update
      setLobby(prev => prev ? { ...prev, status: 'finished' } : null);

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

      toast.success('Game ended!');
      return true;
    } catch (err) {
      toast.error('Failed to end game');
      await fetchInitialData();
      return false;
    }
  }, [lobbyId, userId, supabase, fetchInitialData]);

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
    console.log('🧹 Cleaning up game logic...');
    isMounted.current = false;
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, [supabase]);

  // ✨ INSTANT REALTIME UPDATES
  useEffect(() => {
    isMounted.current = true;
    fetchInitialData();

    console.log('🔌 Setting up realtime for lobby:', lobbyId);

    channelRef.current = supabase
      .channel(`game_${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tod_lobbies',
          filter: `id=eq.${lobbyId}`
        },
        (payload) => {
          console.log('🔥 Lobby update:', payload);
          if (payload.new && isMounted.current) {
            const newLobby = payload.new as Lobby;
            const oldLobby = lobby;
            
            setLobby(newLobby);
            
            // 🎉 INSTANT NOTIFICATIONS
            if (payload.eventType === 'UPDATE' && oldLobby) {
              if (newLobby.status === 'active' && oldLobby.status !== 'active') {
                toast.success('🎮 Game Started!', { duration: 3000 });
              }
              
              if (newLobby.selected_mode && !oldLobby.selected_mode) {
                toast.info(`${newLobby.selected_mode.toUpperCase()} Selected!`, { duration: 2000 });
              }
              
              if (newLobby.current_target_id !== oldLobby.current_target_id) {
                toast.info('🎯 New Round!', { duration: 2000 });
                fetchParticipants();
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tod_participants',
          filter: `lobby_id=eq.${lobbyId}`
        },
        (payload) => {
          console.log('👥 Participants update');
          if (isMounted.current) {
            fetchParticipants();
            if (payload.eventType === 'INSERT') {
              toast.success('👋 New player joined!', { duration: 2000 });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tod_messages',
          filter: `lobby_id=eq.${lobbyId}`
        },
        (payload) => {
          console.log('💬 New message');
          if (isMounted.current && payload.new) {
            const newMsg = payload.new as Message;
            
            setMessages(prev => {
              const filtered = prev.filter(m => 
                !(m.isOptimistic && m.content === newMsg.content && m.user_id === newMsg.user_id)
              );
              
              if (filtered.some(m => m.id === newMsg.id)) return prev;
              
              return [...filtered, { ...newMsg, isSent: true }].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
            
            // Fetch to get profile data
            setTimeout(() => fetchMessages(), 100);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime connected!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime error');
          toast.error('Connection issue. Refreshing...', { duration: 2000 });
          setTimeout(() => fetchInitialData(), 2000);
        }
      });

    return cleanup;
  }, [lobbyId, userId, supabase, fetchInitialData, fetchParticipants, fetchMessages, cleanup]);

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
