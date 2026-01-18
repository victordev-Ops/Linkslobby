// src/components/tod/hooks/useGameLogic.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// Updated Interface with 'status'
export interface Message {
  id: string;
  lobby_id: string;
  user_id: string;
  content: string;
  image_url?: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system';
  created_at: string;
  profiles?: { username: string };
  status: 'sending' | 'sent' | 'error'; // <--- New State Field
}

export const useGameLogic = (lobbyId: string, userId?: string) => {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<Message[]>([]);
  // ... (keep your other states like lobby, participants, etc.)

  // 1. REALTIME LISTENER (Deduplicates messages)
  useEffect(() => {
    if (!lobbyId) return;

    const channel = supabase
      .channel(`game:${lobbyId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'tod_messages', 
        filter: `lobby_id=eq.${lobbyId}` 
      }, async (payload) => {
        
        // Prevent duplicates: If we already have this ID (from optimistic update), ignore it
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;

          // If it's a new message from someone else, add it
          return [...prev, { 
            ...payload.new, 
            status: 'sent', 
            profiles: { username: 'Loading...' } // Placeholder until fetch
          } as Message];
        });
        
        // (Optional: You can add a fetch here to get the username for the new message)
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyId, supabase]);

  // 2. SEND MESSAGE (Optimistic)
  const sendMessage = useCallback(async (
    content: string,
    imageUrl: string | null,
    messageType: 'chat' | 'truth' | 'dare' | 'system',
    username?: string
  ) => {
    if (!userId || !lobbyId) return;

    // A. Generate Temp ID
    const tempId = `temp-${Date.now()}`;
    
    // B. Add to UI Immediately (Status: sending)
    const optimisticMsg: Message = {
      id: tempId,
      lobby_id: lobbyId,
      user_id: userId,
      content: content || '📷 Photo',
      image_url: imageUrl || undefined,
      message_type: messageType,
      created_at: new Date().toISOString(),
      status: 'sending',
      profiles: { username: username || 'You' }
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // C. Send to Server
      const { data, error } = await supabase
        .from('tod_messages')
        .insert({
          lobby_id: lobbyId,
          user_id: userId,
          content: content || '📷 Photo',
          image_url: imageUrl,
          message_type: messageType
        })
        .select()
        .single();

      if (error) throw error;

      // D. Success: Swap Temp ID for Real ID (Status: sent)
      setMessages(prev => prev.map(msg => 
        msg.id === tempId 
          ? { ...msg, id: data.id, status: 'sent', created_at: data.created_at } 
          : msg
      ));

    } catch (err) {
      console.error('Send failed:', err);
      // E. Error: Mark as failed (Status: error)
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...msg, status: 'error' } : msg
      ));
      toast.error('Failed to send message');
    }
  }, [lobbyId, userId, supabase]);

  return {
    messages,
    sendMessage,
    // ... return other states/functions
  };
};
