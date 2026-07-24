import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { showAppSuccess, showAppError, showAppToast } from '@/components/AppToast';
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
  status: 'joined' | 'banned';
  profiles?: { username: string; avatar_url?: string; is_pro?: boolean; last_active_at?: string };
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
  profiles?: { username: string; avatar_url?: string; is_pro?: boolean };
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
      supabase.from('tod_participants').select('*, profiles(username, avatar_url, is_pro, last_active_at)').eq('lobby_id', lobbyId),
      supabase.from('tod_messages')
        .select('*, profiles(username, avatar_url, is_pro)')
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
          .select('*, profiles(username, avatar_url, is_pro)')
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

    // Atomic, guarded write: only the FIRST caller to reach this (the user's
    // manual click or the host's timeout auto-pick, whichever wins the race)
    // actually sets selected_mode. Prevents the system timeout from
    // overwriting a selection the user already made.
    const { data: won, error } = await supabase.rpc('select_tod_mode', {
      lobby_uuid: lobbyId,
      mode,
    });

    if (error) {
      showAppError('Failed to select mode');
      return;
    }

    if (!won) {
      // Someone else's selection (or the timeout) already landed first.
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

    showAppSuccess(`${mode.toUpperCase()} selected!`);
  }, [lobby, userId, lobbyId, supabase, participants]);

  const sendMessage = useCallback(async (
    content: string,
    imageUrl: string | null,
    messageType: 'chat' | 'truth' | 'dare' | 'system' | 'answer',
    username?: string,
    questionRef?: string,
    avatarUrl?: string,
    isPro?: boolean
  ) => {
    if (!userId || !lobby) return;

    // Optimistic update. The id includes a random suffix (not just the
    // timestamp) because ChatInput now allows firing off several sends back
    // to back — two calls landing in the same millisecond would otherwise
    // produce colliding temp ids.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages(prev => [...prev, {
      id: tempId,
      lobby_id: lobbyId,
      user_id: userId,
      content,
      image_url: imageUrl || undefined,
      message_type: messageType,
      created_at: new Date().toISOString(),
      status: 'sending',
      profiles: { username: username || 'You', avatar_url: avatarUrl, is_pro: isPro },
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
      showAppError("Message failed to send");
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }, [lobbyId, userId, lobby, supabase]);

  const startNextRound = async () => {
    // Check for XP penalty (skipped round without answer)
    // Fire and forget - doesn't block game flow
    penalizeSkippedRound(lobbyId).catch(console.error);

    // No optimistic local clearing here. next_tod_turn sets status,
    // current_asker_id, current_target_id, selected_mode, current_question,
    // and turn_started_at together in one atomic transaction. Clearing
    // selected_mode/current_question locally before it runs left
    // current_target_id/current_asker_id pointing at the OLD round for a
    // moment, which is what caused the flash of the wrong user's turn.
    const { error: rpcError } = await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
    if (rpcError) {
      showAppError("Failed to start next round");
      console.error(rpcError);
      return;
    }
    // No follow-up update needed — the RPC already cleared current_question
    // and selected_mode as part of the same transaction. The realtime
    // postgres_changes subscription will deliver the new lobby state.
  };

  const startGame = async () => {
    const { error } = await supabase
      .from('tod_lobbies')
      .update({ status: 'active' })
      .eq('id', lobbyId);

    if (error) {
      showAppError('Failed to start game');
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
      showAppError('Failed to end game');
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!userId) {
      console.error('Cannot upload image: userId is missing');
      showAppError('Authentication error. Please refresh.');
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
      showAppError('Failed to upload image');
      return null;
    }
  };

  // NOTE: approveRequest/declineRequest used to live here for a
  // host-approval "private lobby" flow. That flow was removed from the DB
  // (tod_join_lobby now always auto-joins) and the tod_participants.status
  // CHECK constraint only allows 'joined' | 'banned' — 'pending' and
  // 'rejected' were never valid values, so those two functions could never
  // actually succeed. Removed along with the dead UI that called them.

  const banParticipant = async (participantId: string) => {
    if (!lobby || userId !== lobby.host_id) return;

    const targetUser = participants.find(p => p.id === participantId);
    if (!targetUser) return;

    const { error } = await supabase
      .from('tod_participants')
      .update({ status: 'banned' })
      .eq('id', participantId);

    if (error) {
      showAppError('Failed to ban participant');
      return;
    }

    // Send system message
    await supabase.from('tod_messages').insert({
      lobby_id: lobbyId,
      user_id: userId,
      content: `${targetUser.profiles?.username || 'A player'} has been banned from the lobby.`,
      message_type: 'system'
    });

    showAppSuccess('Participant banned');
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
      showAppError('Failed to unban participant');
      return;
    }

    // Send system message
    await supabase.from('tod_messages').insert({
      lobby_id: lobbyId,
      user_id: userId,
      content: `${targetUser.profiles?.username || 'A player'} has been unbanned.`,
      message_type: 'system'
    });

    showAppSuccess('Participant unbanned');
    fetchData();
  };

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || messages.length === 0) return;

    // Find the current oldest message that isn't optimistic
    const oldestMessage = messages.find(m => !m.id.startsWith('temp-'));
    if (!oldestMessage) return;

    const { data, error } = await supabase
      .from('tod_messages')
      .select('*, profiles(username, avatar_url, is_pro)')
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

  const leaveLobby = async (): Promise<boolean> => {
    if (!lobby || !userId) return false;

    try {
      const { data, error } = await supabase.rpc('leave_tod_lobby', {
        p_lobby_id: lobbyId,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Leave failed');

      showAppSuccess('You left the lobby');
      return true;
    } catch (_err) {
      console.error('Error leaving lobby:', _err);
      showAppError('Failed to leave lobby');
      return false;
    }
  };

  const deleteLobby = async (): Promise<boolean> => {
    if (!lobby || !userId || lobby.host_id !== userId) return false;

    try {
      const { data, error } = await supabase.rpc('delete_tod_lobby', {
        p_lobby_id: lobbyId,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Delete failed');

      showAppSuccess('Lobby deleted');
      return true;
    } catch (_err) {
      console.error('Error deleting lobby:', _err);
      showAppError('Failed to delete lobby');
      return false;
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
      showAppError('Failed to remove participant');
      return;
    }

    // Send system message
    await supabase.from('tod_messages').insert({
      lobby_id: lobbyId,
      user_id: userId,
      content: `${targetUser.profiles?.username || 'A player'} has been removed from the lobby.`,
      message_type: 'system'
    });

    showAppSuccess('Participant removed');
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

        showAppToast(`Time's up! Randomly selected: ${randomMode}`, { variant: 'info' });
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
