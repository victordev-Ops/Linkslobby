// src/components/tod/hooks/useGameLogic.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Lobby {
  id: string;
  host_id: string;
  status: 'waiting' | 'active' | 'finished';
  current_asker_id?: string;
  current_target_id?: string;
  selected_mode?: 'truth' | 'dare';
  current_question?: string;
  turn_started_at?: string;
  created_at: string;
}

interface Participant {
  user_id: string;
  lobby_id: string;
  has_gone_this_round: boolean;
  status: 'pending' | 'joined';
  profiles?: { username: string };
}

interface Message {
  id: string;
  lobby_id: string;
  user_id: string;
  content: string;
  image_url?: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system' | 'answer';
  created_at: string;
  status?: 'sending' | 'sent' | 'error';
  profiles?: { username: string };
  question_ref?: string; // Foreign key to the question message
}

export const useGameLogic = (lobbyId: string, userId?: string) => {
  const [supabase] = useState(() => createClient());
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const PAGE_SIZE = 10;

  const fetchData = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined') {
      setErrorStatus('Invalid lobby ID');
      setIsLoading(false);
      return;
    }

    const [lobbyRes, partsRes, msgsRes] = await Promise.all([
      supabase.from('tod_lobbies').select('*').eq('id', lobbyId).single(),
      supabase.from('tod_participants').select('*, profiles(username)').eq('lobby_id', lobbyId),
      supabase.from('tod_messages')
        .select('*, profiles(username)')
        .eq('lobby_id', lobbyId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)
    ]);

    if (lobbyRes.error) {
      setErrorStatus('Lobby not found');
    } else if (lobbyRes.data) {
      setLobby(lobbyRes.data);
    }

    if (partsRes.data) setParticipants(partsRes.data);
    if (msgsRes.data) {
      // Reverse to get chronological order (we fetched DESC for limit)
      const initialMsgs = [...msgsRes.data].reverse().map(m => ({ ...m, status: 'sent' as const }));
      setMessages(initialMsgs);
      setHasMoreMessages(msgsRes.data.length === PAGE_SIZE);
    }
    setIsLoading(false);
  }, [lobbyId, supabase]);

  // Realtime subscriptions
  useEffect(() => {
    if (!lobbyId || lobbyId === 'undefined') return;

    const channel = supabase.channel(`game:${lobbyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tod_lobbies',
        filter: `id=eq.${lobbyId}`
      }, (payload) => {
        setLobby(prev => ({ ...prev, ...payload.new } as Lobby));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tod_messages',
        filter: `lobby_id=eq.${lobbyId}`
      }, async (payload) => {
        // Fetch the complete message with profile data
        const { data } = await supabase
          .from('tod_messages')
          .select('*, profiles(username)')
          .eq('id', payload.new.id)
          .single();

        if (data) {
          setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, { ...data, status: 'sent' as const } as Message];
          });
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tod_participants',
        filter: `lobby_id=eq.${lobbyId}`
      }, () => {
        fetchData();
      })
      .subscribe();

    fetchData();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId, supabase, fetchData]);

  // Timer for mode selection (target user has 60s to select truth or dare)
  useEffect(() => {
    if (!lobby || lobby.status !== 'active' || !lobby.turn_started_at || lobby.selected_mode) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(lobby.turn_started_at!).getTime()) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimeRemaining(remaining);

      // Auto-select random mode if time runs out
      if (remaining === 0 && userId === lobby.host_id) {
        const randomMode = Math.random() > 0.5 ? 'truth' : 'dare';
        selectMode(randomMode);
        toast.info(`Time's up! Randomly selected: ${randomMode}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lobby?.turn_started_at, lobby?.status, lobby?.selected_mode, userId, lobby?.host_id]);

  const selectMode = async (mode: 'truth' | 'dare') => {
    if (!lobby || !userId) return;

    // Update lobby with selected mode
    const { error } = await supabase
      .from('tod_lobbies')
      .update({ selected_mode: mode })
      .eq('id', lobbyId);

    if (error) {
      toast.error('Failed to select mode');
      return;
    }

    // Get target username
    const targetParticipant = participants.find(p => p.user_id === lobby.current_target_id);
    const targetUsername = targetParticipant?.profiles?.username || 'Someone';

    // Send system message notifying everyone
    await supabase.from('tod_messages').insert({
      lobby_id: lobbyId,
      user_id: userId,
      content: `${targetUsername} selected ${mode.toUpperCase()}! 🎯`,
      message_type: 'system'
    });

    toast.success(`${mode.toUpperCase()} selected!`);
  };

  const sendMessage = useCallback(async (
    content: string,
    imageUrl: string | null,
    messageType: 'chat' | 'truth' | 'dare' | 'system' | 'answer',
    username?: string,
    questionRef?: string
  ) => {
    if (!userId || !lobby) return;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId,
      lobby_id: lobbyId,
      user_id: userId,
      content,
      image_url: imageUrl || undefined,
      message_type: messageType,
      created_at: new Date().toISOString(),
      status: 'sending',
      profiles: { username: username || 'You' },
      question_ref: questionRef
    }]);

    try {
      // Insert message with question_ref for answers
      const { data, error } = await supabase.from('tod_messages').insert({
        lobby_id: lobbyId,
        user_id: userId,
        content,
        image_url: imageUrl,
        message_type: messageType,
        question_ref: questionRef || null // Only set for answer messages
      }).select('id').single();

      if (error) throw error;

      // Update optimistic message with real ID and sent status
      // This ensures the double tick shows immediately and prevents flickering
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, status: 'sent' as const } : m));

      // If this is a question (truth/dare), update lobby with the question
      if ((messageType === 'truth' || messageType === 'dare') && userId === lobby.current_asker_id) {
        await supabase
          .from('tod_lobbies')
          .update({ current_question: content })
          .eq('id', lobbyId);
      }

    } catch (err) {
      toast.error("Message failed to send");
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }, [lobbyId, userId, lobby, supabase]);

  const startNextRound = async () => {
    const { error } = await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
    if (error) {
      toast.error("Failed to start next round");
      console.error(error);
    }
  };

  const startGame = async () => {
    const { error } = await supabase
      .from('tod_lobbies')
      .update({ status: 'active' })
      .eq('id', lobbyId);

    if (error) {
      toast.error('Failed to start game');
      return;
    }

    // Start first round
    await startNextRound();
  };

  const endGame = async () => {
    const { error } = await supabase
      .from('tod_lobbies')
      .update({ status: 'finished' })
      .eq('id', lobbyId);

    if (error) {
      toast.error('Failed to end game');
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const path = `${lobbyId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from('tod-images')
        .upload(path, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from('tod-images')
        .getPublicUrl(path);

      return data.publicUrl;
    } catch (err) {
      toast.error('Failed to upload image');
      return null;
    }
  };

  const approveRequest = async (targetUserId: string) => {
    if (!lobby || userId !== lobby.host_id) return;

    const { error } = await supabase
      .from('tod_participants')
      .update({ status: 'joined' })
      .eq('lobby_id', lobbyId)
      .eq('user_id', targetUserId);

    if (error) {
      toast.error('Failed to approve request');
      return;
    }

    // Notify others
    const targetUser = participants.find(p => p.user_id === targetUserId);
    await supabase.from('tod_messages').insert({
      lobby_id: lobbyId,
      user_id: userId,
      content: `${targetUser?.profiles?.username || 'Someone'} has joined the game! 🎉`,
      message_type: 'system'
    });

    toast.success('Player approved!');
    fetchData();
  };

  const declineRequest = async (targetUserId: string) => {
    if (!lobby || userId !== lobby.host_id) return;

    const { error } = await supabase
      .from('tod_participants')
      .delete()
      .eq('lobby_id', lobbyId)
      .eq('user_id', targetUserId);

    if (error) {
      toast.error('Failed to decline request');
      return;
    }

    toast.info('Request declined');
    fetchData();
  };

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || messages.length === 0) return;

    // Find the current oldest message that isn't optimistic
    const oldestMessage = messages.find(m => !m.id.startsWith('temp-'));
    if (!oldestMessage) return;

    const { data, error } = await supabase
      .from('tod_messages')
      .select('*, profiles(username)')
      .eq('lobby_id', lobbyId)
      .lt('created_at', oldestMessage.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      console.error("Error loading more messages:", error);
      return;
    }

    if (data) {
      const moreMsgs = [...data].reverse().map(m => ({ ...m, status: 'sent' as const }));
      setMessages(prev => [...moreMsgs, ...prev]);
      setHasMoreMessages(data.length === PAGE_SIZE);
    }
  }, [lobbyId, messages, hasMoreMessages, supabase]);

  const cleanup = () => {
    // Cleanup function for component unmount
  };

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
    cleanup,
    approveRequest,
    declineRequest,
    loadMoreMessages,
    hasMoreMessages
  };
};
