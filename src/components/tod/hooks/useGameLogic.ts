import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';
import { earnXP, XP_REWARDS } from '@/hooks/xp';
import { penalizeSkippedRound, penalizeSystemModeSelection } from '@/actions/tod-xp';

interface Lobby {
  id: string;
  host_id: string;
  name?: string;
  status: 'waiting' | 'active' | 'finished';
  current_asker_id?: string;
  current_target_id?: string;
  selected_mode?: 'truth' | 'dare';
  current_question?: string;
  turn_started_at?: string;
  created_at: string;
}

export interface Participant {
  id: string;
  user_id: string;
  lobby_id: string;
  has_gone_this_round: boolean;
  status: 'pending' | 'joined' | 'rejected' | 'banned';
  profiles?: { username: string; avatar_url?: string; is_pro?: boolean };
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
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string, lastTyped: number }>>({});
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const hasHandledTimeout = useRef<boolean>(false);
  const PAGE_SIZE = 10;

  const fetchData = useCallback(async () => {
    if (!lobbyId || lobbyId === 'undefined') {
      setErrorStatus('Invalid lobby ID');
      setIsLoading(false);
      return;
    }

    const [lobbyRes, partsRes, msgsRes] = await Promise.all([
      supabase.from('tod_lobbies').select('*').eq('id', lobbyId).single(),
      supabase.from('tod_participants').select('*, profiles(username, avatar_url, is_pro)').eq('lobby_id', lobbyId),
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
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!lobbyId || lobbyId === 'undefined') return;

    const gameChannel = supabase.channel(`game:${lobbyId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tod_lobbies',
        filter: `id=eq.${lobbyId}`
      }, (payload) => {
        setLobby(prev => ({ ...prev, ...payload.new } as Lobby));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { userId: typingUserId, username, isTyping } = payload;
        if (typingUserId === userId) return;

        setTypingUsers(prev => {
          const next = { ...prev };
          if (isTyping) {
            next[typingUserId] = { username, lastTyped: Date.now() };
          } else {
            delete next[typingUserId];
          }
          return next;
        });
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
      .on('presence', { event: 'sync' }, () => {
        const state = gameChannel.presenceState();
        const onlineIds = new Set<string>();
        Object.values(state).forEach((presences) => {
          (presences as any[]).forEach((p) => {
            if (p.key) onlineIds.add(p.key);
          });
        });
        setOnlineUsers(onlineIds);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        // Only remove if no more presences for this key
        const state = gameChannel.presenceState();
        if (!state[key] || state[key].length === 0) {
          setOnlineUsers(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && userId) {
          await gameChannel.track({ key: userId, online_at: new Date().toISOString() });
          setChannel(gameChannel);
        }
      });

    fetchData();

    return () => {
      supabase.removeChannel(gameChannel);
      setChannel(null);
    };
  }, [lobbyId, supabase, fetchData, userId]);

  // Typing indicator cleanup - remove users who haven't sent a typing update in 5s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([id, data]) => {
          if (now - data.lastTyped > 5000) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);


  const selectMode = useCallback(async (mode: 'truth' | 'dare') => {
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
  }, [lobby, userId, lobbyId, supabase, participants]);

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
  const { data: ok, error: qError } = await supabase.rpc('submit_tod_question', {
    lobby_uuid: lobbyId,
    question_text: content,
  });
  if (qError || !ok) {
    console.error('Failed to set current_question:', qError);
  }
        }

    } catch {
      toast.error("Message failed to send");
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }, [lobbyId, userId, lobby, supabase]);

  const startNextRound = async () => {
    // Check for XP penalty (skipped round without answer)
    // Fire and forget - doesn't block game flow
    penalizeSkippedRound(lobbyId).catch(console.error);

    // OPTIMISTIC UPDATE: Clear state immediately so UI doesn't get stuck waiting for realtime updates
    setLobby(prev => prev ? { ...prev, selected_mode: undefined, current_question: undefined } : prev);

    // 1. First trigger the turn logic RPC
    const { error: rpcError } = await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
    if (rpcError) {
      toast.error("Failed to start next round");
      console.error(rpcError);
      return;
    }

    // 2. Explicitly clear question and mode to ensure fresh state for the new round
    // This fixes the bug where subsequent rounds might stay in "chat mode" or match old questions
    const { error: updateError } = await supabase
      .from('tod_lobbies')
      .update({
        current_question: null,
        selected_mode: null
      })
      .eq('id', lobbyId);

    if (updateError) {
      console.error("Error clearing round state:", updateError);
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
    if (!userId) {
      console.error('Cannot upload image: userId is missing');
      toast.error('Authentication error. Please refresh.');
      return null;
    }

    try {
      const path = `${userId}/${lobbyId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from('chat-attachments')
        .upload(path, file);

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      const { data } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(path);

      return data.publicUrl;
    } catch (err) {
      console.error('uploadImage error:', err);
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

    // Award Host XP for approving a participant
    await earnXP(XP_REWARDS.TOD_PARTICIPANT_JOINED, 'Player joined lobby', { lobby_id: lobbyId });

    toast.success('Player approved!');
    fetchData();
  };

  const declineRequest = async (targetUserId: string) => {
    if (!lobby || userId !== lobby.host_id) return;

    const { error } = await supabase
      .from('tod_participants')
      .update({ status: 'rejected' })
      .eq('lobby_id', lobbyId)
      .eq('user_id', targetUserId);

    if (error) {
      toast.error('Failed to decline request');
      return;
    }

    toast.info('Request declined');
    fetchData();
  };

  const banParticipant = async (participantId: string) => {
    if (!lobby || userId !== lobby.host_id) return;

    const targetUser = participants.find(p => p.id === participantId);
    if (!targetUser) return;

    const { error } = await supabase
      .from('tod_participants')
      .update({ status: 'banned' })
      .eq('id', participantId);

    if (error) {
      toast.error('Failed to ban participant');
      return;
    }

    // Send system message
    await supabase.from('tod_messages').insert({
      lobby_id: lobbyId,
      user_id: userId,
      content: `${targetUser.profiles?.username || 'A player'} has been banned from the lobby.`,
      message_type: 'system'
    });

    toast.success('Participant banned');
    fetchData();
  };

  const unbanParticipant = async (participantId: string) => {
    if (!lobby || userId !== lobby.host_id) return;

    const targetUser = participants.find(p => p.id === participantId);
    if (!targetUser) return;

    const { error } = await supabase
      .from('tod_participants')
      .update({ status: 'joined' })
      .eq('id', participantId);

    if (error) {
      toast.error('Failed to unban participant');
      return;
    }

    // Send system message
    await supabase.from('tod_messages').insert({
      lobby_id: lobbyId,
      user_id: userId,
      content: `${targetUser.profiles?.username || 'A player'} has been unbanned.`,
      message_type: 'system'
    });

    toast.success('Participant unbanned');
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

  const leaveLobby = async () => {
    if (!lobby || !userId) return;

    try {
      const { error } = await supabase
        .from('tod_participants')
        .delete()
        .eq('lobby_id', lobbyId)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('You left the lobby');
    } catch (_err) {
      console.error('Error leaving lobby:', _err);
      toast.error('Failed to leave lobby');
    }
  };

  const deleteLobby = async () => {
    if (!lobby || !userId || lobby.host_id !== userId) return;

    try {
      const { error } = await supabase
        .from('tod_lobbies')
        .delete()
        .eq('id', lobbyId);

      if (error) throw error;
      toast.success('Lobby deleted');
    } catch (_err) {
      console.error('Error deleting lobby:', _err);
      toast.error('Failed to delete lobby');
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!lobby || userId !== lobby.host_id) return;

    const targetUser = participants.find(p => p.id === participantId);
    if (!targetUser) return;

    const { error } = await supabase
      .from('tod_participants')
      .delete()
      .eq('id', participantId);

    if (error) {
      toast.error('Failed to remove participant');
      return;
    }

    // Send system message
    await supabase.from('tod_messages').insert({
      lobby_id: lobbyId,
      user_id: userId,
      content: `${targetUser.profiles?.username || 'A player'} has been removed from the lobby.`,
      message_type: 'system'
    });

    toast.success('Participant removed');
    fetchData();
  };

  const cleanup = () => {
    // Cleanup function for component unmount
  };

  const setTypingIndicator = useCallback((isTyping: boolean) => {
    if (!channel || !userId) return;

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, username: participants.find(p => p.user_id === userId)?.profiles?.username || 'Someone', isTyping }
    });
  }, [channel, userId, participants]);

  // Timer for mode selection (target user has 60s to select truth or dare)
  useEffect(() => {
    if (!lobby || lobby.status !== 'active' || !lobby.turn_started_at || lobby.selected_mode) {
      hasHandledTimeout.current = false;
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(lobby.turn_started_at!).getTime()) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0 && userId === lobby.host_id && !hasHandledTimeout.current) {
        hasHandledTimeout.current = true;
        const randomMode = Math.random() > 0.5 ? 'truth' : 'dare';
        selectMode(randomMode);

        // XP Penalty for system selection
        penalizeSystemModeSelection(lobbyId).catch(console.error);

        toast.info(`Time's up! Randomly selected: ${randomMode}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lobby, userId, selectMode, lobbyId]);

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
    banParticipant,
    unbanParticipant,
    leaveLobby,
    deleteLobby,
    loadMoreMessages,
    hasMoreMessages,
    onlineUsers,
    typingUsers,
    setTypingIndicator,
    removeParticipant
  };
};
