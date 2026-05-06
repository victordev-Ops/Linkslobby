// src/components/tod/ui/WaitingRoom.tsx
import { Play, Users, Clock, UserPlus, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { FriendshipWithProfile } from '@/actions/friends';

interface WaitingRoomProps {
  isHost: boolean;
  playersCount: number;
  onStartGame: () => void;
  friends?: FriendshipWithProfile[];
  invitedFriendIds?: Set<string>;
  onInviteFriend?: (friendUserId: string) => Promise<void>;
  isLoadingFriends?: boolean;
}

export const WaitingRoom = ({
  isHost,
  playersCount,
  onStartGame,
  friends = [],
  invitedFriendIds = new Set(),
  onInviteFriend,
  isLoadingFriends = false,
}: WaitingRoomProps) => {
  const [showFriends, setShowFriends] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const handleInvite = async (friendUserId: string) => {
    if (!onInviteFriend || invitedFriendIds.has(friendUserId)) return;
    setInvitingId(friendUserId);
    try {
      await onInviteFriend(friendUserId);
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 min-h-[50vh]">
      <div className="max-w-md w-full">
        {/* Animated Icon */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-orange-500 rounded-full animate-pulse opacity-50" />
          <div className="absolute inset-2 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-2xl">
            <Users size={40} className="text-white" />
          </div>
        </div>

        {/* Status */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3 italic">
            Waiting Room
          </h2>
          <p className="text-slate-400 text-sm md:text-base mb-4">
            Share the invite link with friends to join
          </p>
          
          {/* Player Count Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/80 border border-slate-700 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-white font-bold">{playersCount} Player{playersCount !== 1 ? 's' : ''} Connected</span>
          </div>
        </div>

        {/* Instructions */}
        {isHost ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-white text-center font-semibold mb-3">
                You're the host! Start the game when everyone's ready.
              </p>
              <button
                onClick={onStartGame}
                disabled={playersCount < 2}
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={20} />
                {playersCount < 2 ? 'Need 2+ Players' : 'Start Game'}
              </button>
            </div>
            
            <p className="text-xs text-slate-500 text-center">
              Minimum 2 players required to start
            </p>

            {/* Invite Friends Section (Host only) */}
            {onInviteFriend && (
              <div className="mt-2">
                <button
                  onClick={() => setShowFriends(!showFriends)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white font-semibold text-sm hover:bg-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <UserPlus size={16} className="text-orange-400" />
                    Invite Friends
                    {friends.length > 0 && (
                      <span className="bg-slate-700 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {friends.length}
                      </span>
                    )}
                  </span>
                  {showFriends ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>

                {showFriends && (
                  <div className="mt-2 bg-slate-800/40 border border-slate-700/30 rounded-xl overflow-hidden">
                    {isLoadingFriends ? (
                      <div className="py-8 flex flex-col items-center gap-2">
                        <Loader2 size={20} className="animate-spin text-slate-400" />
                        <p className="text-xs text-slate-500">Loading friends...</p>
                      </div>
                    ) : friends.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm text-slate-400">No friends yet</p>
                        <p className="text-xs text-slate-500 mt-1">Add friends to invite them!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-700/30 max-h-48 overflow-y-auto">
                        {friends.map((f) => {
                          const isInvited = invitedFriendIds.has(f.profile.id);
                          const isInviting = invitingId === f.profile.id;
                          return (
                            <div key={f.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {f.profile.username?.[0]?.toUpperCase() || '?'}
                                </div>
                                <span className="text-sm text-white font-medium truncate">
                                  {f.profile.username}
                                </span>
                              </div>
                              <button
                                onClick={() => handleInvite(f.profile.id)}
                                disabled={isInvited || isInviting}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex-shrink-0 ${
                                  isInvited
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:shadow-lg hover:shadow-red-500/30'
                                } disabled:opacity-70 disabled:cursor-not-allowed`}
                              >
                                {isInviting ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : isInvited ? (
                                  <>
                                    <Check size={12} />
                                    Sent
                                  </>
                                ) : (
                                  <>
                                    <UserPlus size={12} />
                                    Invite
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm text-center">
            <Clock size={32} className="text-slate-400 mx-auto mb-3" />
            <p className="text-white font-semibold mb-2">
              Waiting for host to start...
            </p>
            <p className="text-slate-400 text-sm">
              The game will begin shortly
            </p>
          </div>
        )}

        {/* How to Play */}
        <div className="mt-8 space-y-3">
          <h3 className="text-white font-bold text-sm uppercase tracking-wide text-center mb-4">
            How to Play
          </h3>
          <div className="space-y-2">
            {[
              'Players take turns being asked truth or dare',
              'Swipe the question card to reply with your answer',
              'The answer will be directly linked to the question',
              'Have fun and keep it friendly! 🎉'
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-400 font-bold text-xs">{idx + 1}</span>
                </div>
                <p className="text-slate-300 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
