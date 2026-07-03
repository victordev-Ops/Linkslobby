"use client";

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CreateLobbyButtonProps {
  userId: string;
}

export const CreateLobbyButton = ({ userId }: CreateLobbyButtonProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreateLobby = async () => {
    setIsCreating(true);
    try {
      // Goes through the shared server action so the free/pro lobby limit
      // is always enforced the same way, no matter where "create" is
      // triggered from.
      const { createLobbyAction } = await import('@/actions/tod-xp');
      const result = await createLobbyAction('Game Lobby', 'Casual');

      if (!result.success) {
        if (result.limitReached) {
          toast.error(result.message || "You've reached your lobby limit");
          router.push('/tod');
          return;
        }
        throw new Error(result.message || 'Failed to create lobby');
      }

      toast.success('Lobby created! 🎉');
      router.push(`/tod/${result.lobby.slug || result.lobby.id}`);
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
