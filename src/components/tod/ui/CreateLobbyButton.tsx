"use client";

import { Plus, Share2, ArrowRight, Dices } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CreateLobbyButtonProps {
  userId: string;
}

export const CreateLobbyButton = ({ userId }: CreateLobbyButtonProps) => {
  const [isCreating, setIsCreating] = useState(false);
  // Previously this component created the lobby and redirected straight
  // in, with no chance to invite friends first — the "Enter or Invite"
  // choice only existed in LobbyListClient's create flow. This state
  // brings the same post-creation modal here so both entry points behave
  // the same way.
  const [newlyCreatedLobby, setNewlyCreatedLobby] = useState<{ slug: string; id: string; name?: string } | null>(null);
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
      setNewlyCreatedLobby({
        slug: result.lobby.slug || result.lobby.id,
        id: result.lobby.id,
        name: result.lobby.name,
      });
    } catch (error: any) {
      toast.error('Failed to create lobby');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleShare = async () => {
    if (!newlyCreatedLobby) return;
    const lobbyUrl = `${window.location.origin}/tod/${newlyCreatedLobby.slug}`;
    const shareData = {
      title: `Join my Truth or Dare lobby! 🔥`,
      text: `Come play Truth or Dare with me on Say! Join "${newlyCreatedLobby.name || 'my lobby'}" 🎉`,
      url: lobbyUrl,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(lobbyUrl);
        toast.success('Link copied! Send it to your friends 🔗');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        await navigator.clipboard.writeText(lobbyUrl);
        toast.success('Link copied! Send it to your friends 🔗');
      }
    }
  };

  return (
    <>
      <button
        onClick={handleCreateLobby}
        disabled={isCreating}
        className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 py-4 rounded-2xl font-bold shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus size={20} />
        {isCreating ? 'Creating...' : 'Create New Game'}
      </button>

      {newlyCreatedLobby && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl">
          <div className="bg-slate-950 border border-slate-800 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center mb-1">
                <Dices size={28} className="text-orange-400" />
              </div>
              <h3 className="text-2xl font-black text-white italic tracking-tight">Lobby Created! 🎉</h3>
              <p className="text-slate-400 text-sm">
                <span className="font-bold text-white">{newlyCreatedLobby.name}</span> is ready to go.<br />
                Invite your friends to join the fun!
              </p>
            </div>

            <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex flex-col gap-3">
              <button
                onClick={handleShare}
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-red-500/20 hover:shadow-red-500/40 hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Share2 size={18} />
                Invite Friends
              </button>
              <button
                onClick={() => {
                  const slug = newlyCreatedLobby.slug;
                  setNewlyCreatedLobby(null);
                  router.push(`/tod/${slug}`);
                }}
                className="w-full py-4 rounded-[1.5rem] font-black uppercase tracking-widest border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <ArrowRight size={18} />
                Enter Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
    
