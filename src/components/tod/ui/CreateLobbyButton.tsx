"use client";

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CreateLobbyButtonProps {
  userId: string;
}

export const CreateLobbyButton = ({ userId }: CreateLobbyButtonProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleCreateLobby = async () => {
    setIsCreating(true);
    try {
      // Create new lobby
      const { data: lobby, error: lobbyError } = await supabase
        .from('tod_lobbies')
        .insert({
          host_id: userId,
          status: 'waiting'
        })
        .select()
        .single();

      if (lobbyError) throw lobbyError;

      // Auto-join as participant
      const { error: joinError } = await supabase
        .from('tod_participants')
        .insert({
          lobby_id: lobby.id,
          user_id: userId
        });

      if (joinError) throw joinError;

      toast.success('Lobby created! 🎉');
      router.push(`/tod/${lobby.id}`);
    } catch (error: any) {
      toast.error('Failed to create lobby');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <button
      onClick={handleCreateLobby}
      disabled={isCreating}
      className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 py-4 rounded-2xl font-bold shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Plus size={20} />
      {isCreating ? 'Creating...' : 'Create New Game'}
    </button>
  );
};
      
