// src/components/tod/ui/PlayersSidebar.tsx
import { Users, Crown, Target, MessageCircle, Activity, Flame, Sparkles, Play, StopCircle, UserPlus, Check, X, Ban, ShieldOff, MoreVertical, LogOut } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

import { Participant } from '../hooks/useGameLogic';

interface Message {
  id: string;
  content: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system' | 'answer';
  created_at: string;
  profiles?: { username: string };
}

interface PlayersSidebarProps {
  participants: Participant[];
  messages: Message[];
  currentTargetId?: string;
  hostId: string;
  className?: string;
  onActivityClick?: (messageId: string) => void;
  pendingRequests?: Participant[];
  bannedParticipants?: Participant[];
  onApproveRequest?: (userId: string) => void;
  onDeclineRequest?: (userId: string) => void;
  onBanParticipant?: (participantId: string) => void;
  onUnbanParticipant?: (participantId: string) => void;
  onRemoveParticipant?: (participantId: string) => void;
  isHost?: boolean;
  onlineUsers?: Set<string>;
  currentAskerId?: string;
  lobbyName?: string;
}

export const PlayersSidebar = ({
  participants,
  messages,
  currentTargetId,
  hostId,
  className = '',
  onActivityClick,
  pendingRequests = [],
  bannedParticipants = [],
  onApproveRequest,
  onDeclineRequest,
  onBanParticipant,
  onUnbanParticipant,
  onRemoveParticipant,
  isHost = false,
  onlineUsers = new Set(),
  currentAskerId,
  lobbyName
}: PlayersSidebarProps) => {
  const router = useRouter();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filter for game events: truth/dare questions, system messages (start/end)
  const gameEvents = messages.filter(m =>
    m.message_type === 'system' ||
    m.message_type === 'truth' ||
    m.message_type === 'dare'
  );

  const getEventIcon = (messageType: string, content: string) => {
    if (content.toLowerCase().includes('started')) return Play;
    if (content.toLowerCase().includes('ended') || content.toLowerCase().includes('finished')) return StopCircle;
    if (messageType === 'truth') return MessageCircle;
    if (messageType === 'dare') return Flame;
    return Sparkles;
  };

  const getEventColor = (messageType: string, content: string) => {
    if (content.toLowerCase().includes('started')) return 'text-green-400';
    if (content.toLowerCase().includes('ended') || content.toLowerCase().includes('finished')) return 'text-red-400';
    if (messageType === 'truth') return 'text-blue-400';
    if (messageType === 'dare') return 'text-orange-400';
    return 'text-slate-400';
  };

  const handleActivityClick = (messageId: string) => {
    if (onActivityClick) {
      onActivityClick(messageId);
    } else {
      // Default scroll behavior
      const element = document.getElementById(`message-${messageId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add temporary highlight
        element.classList.add('ring-2', 'ring-red-500', 'ring-offset-2', 'ring-offset-slate-950');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2', 'ring-offset-slate-950');
        }, 2000);
      }
    }
  };

  return (
    <aside className={`w-64 flex-shrink-0 border-r border-slate-800/50 bg-slate-900/30 backdrop-blur-sm flex flex-col ${className}`}>
      {/* Lobby Name Header - Added for mobile first / sidebar context */}
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/40">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-red-400" />
          <h2 className="text-white font-black text-base italic tracking-tight truncate">
            {lobbyName || 'Game Lobby'}
          </h2>
        </div>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          Truth or Dare
        </p>
      </div>
      {/* Join Requests Section */}
      {isHost && pendingRequests.length > 0 && (
        <div className="p-4 border-b border-slate-800/50 bg-red-500/5">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus size={18} className="text-orange-400" />
            <h3 className="text-white font-bold text-sm uppercase tracking-wide">
              Requests ({pendingRequests.length})
            </h3>
          </div>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div key={req.user_id} className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">
                        {(req.profiles?.username || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[80px]">
                      {req.profiles?.username}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onApproveRequest?.(req.user_id)}
                    className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition"
                  >
                    <Check size={12} /> Accept
                  </button>
                  <button
                    onClick={() => onDeclineRequest?.(req.user_id)}
                    className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition"
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Players Section */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-red-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-wide">
            Players ({participants.length})
          </h3>
        </div>

        <div className="space-y-2">
          {participants.map((participant) => {
            const isParticipantHost = participant.user_id === hostId;
            const isTarget = participant.user_id === currentTargetId;
            const isAsker = participant.user_id === currentAskerId;
            const isOnline = onlineUsers.has(participant.user_id);
            const hasTurn = participant.has_gone_this_round;

            return (
              <div
                key={participant.user_id}
                className={`flex items-center justify-between p-2 rounded-lg transition-all border ${isTarget
                  ? 'bg-red-500/20 border-red-500/50'
                  : isAsker
                    ? 'bg-blue-500/20 border-blue-500/50'
                    : 'bg-slate-800/30 border-slate-700/30'
                  }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative ${isTarget
                    ? 'bg-gradient-to-br from-red-500 to-orange-500'
                    : isAsker
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                      : 'bg-slate-700'
                    }`}>
                    <span className="text-white font-bold text-xs uppercase">
                      {participant.profiles?.username?.slice(0, 2) || '??'}
                    </span>
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 shadow-sm" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isTarget ? 'text-white' : isAsker ? 'text-blue-100' : 'text-slate-300'
                      }`}>
                      {participant.profiles?.username || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-1">
                      {isTarget && (
                        <span className="text-[10px] font-black uppercase text-red-400/80 tracking-tighter">Target</span>
                      )}
                      {isAsker && (
                        <span className="text-[10px] font-black uppercase text-blue-400/80 tracking-tighter">Asker</span>
                      )}
                      {!isTarget && !isAsker && hasTurn && (
                        <p className="text-[10px] text-slate-500 font-medium">Played</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {isParticipantHost && (
                    <Crown size={14} className="text-amber-400" />
                  )}
                  {isTarget && (
                    <Target size={14} className="text-red-400 animate-pulse" />
                  )}
                  {isAsker && (
                    <MessageCircle size={14} className="text-blue-400 animate-bounce [animation-duration:2s]" />
                  )}
                  {/* Player Actions Menu */}
                  <div className="relative">
                    {(participant.user_id !== (participants.find(p => p.user_id === hostId)?.user_id) || isHost) && ( // Show for everyone except maybe self? Logic: everyone can DM everyone
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === participant.id ? null : participant.id);
                        }}
                        className="ml-1 w-6 h-6 rounded hover:bg-slate-800 flex items-center justify-center transition text-slate-400 hover:text-white"
                      >
                        <MoreVertical size={14} />
                      </button>
                    )}

                    <AnimatePresence>
                      {activeMenuId === participant.id && (
                        <>
                          <div
                            className="fixed inset-0 z-[50]"
                            onClick={() => setActiveMenuId(null)}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -5 }}
                            className="absolute right-0 top-full mt-1 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-[60] overflow-hidden flex flex-col p-1"
                          >
                            <button
                              onClick={() => {
                                // Default to ID if username is missing, but prefer username
                                const identifier = participant.profiles?.username || participant.user_id;
                                router.push(`/messages/${identifier}`);
                                setActiveMenuId(null);
                              }}
                              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors text-left w-full"
                            >
                              <MessageCircle size={14} className="text-blue-400" />
                              Message
                            </button>

                            {isHost && participant.user_id !== hostId && (
                              <>
                                <div className="h-px bg-slate-800 my-1" />
                                {onRemoveParticipant && (
                                  <button
                                    onClick={() => {
                                      onRemoveParticipant(participant.id);
                                      setActiveMenuId(null);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors text-left w-full"
                                  >
                                    <LogOut size={14} className="text-orange-400" />
                                    Remove
                                  </button>
                                )}
                                {onBanParticipant && (
                                  <button
                                    onClick={() => {
                                      onBanParticipant(participant.id);
                                      setActiveMenuId(null);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-left w-full"
                                  >
                                    <Ban size={14} className="text-red-400" />
                                    Ban Player
                                  </button>
                                )}
                              </>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Banned Participants Section */}
      {isHost && bannedParticipants.length > 0 && (
        <div className="p-4 border-b border-slate-800/50 bg-red-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Ban size={18} className="text-red-400" />
            <h3 className="text-white font-bold text-sm uppercase tracking-wide">
              Banned ({bannedParticipants.length})
            </h3>
          </div>
          <div className="space-y-2">
            {bannedParticipants.map((banned) => (
              <div key={banned.user_id} className="bg-slate-800/50 p-2 rounded-lg border border-red-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-red-400">
                        {(banned.profiles?.username || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[80px]">
                      {banned.profiles?.username}
                    </span>
                  </div>
                  <Ban size={12} className="text-red-400" />
                </div>
                <button
                  onClick={() => onUnbanParticipant?.(banned.id)}
                  className="w-full bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition"
                >
                  <ShieldOff size={12} /> Unban
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game Activity Section */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-orange-400" />
          <h3 className="text-white font-bold text-sm uppercase tracking-wide">
            Game Activity
          </h3>
        </div>

        {gameEvents.length > 0 ? (
          <div className="space-y-2">
            {gameEvents.map((event) => {
              const EventIcon = getEventIcon(event.message_type, event.content);
              const iconColor = getEventColor(event.message_type, event.content);

              return (
                <button
                  key={event.id}
                  onClick={() => handleActivityClick(event.id)}
                  className="w-full p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:bg-slate-800/50 hover:border-slate-600/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-2">
                    <EventIcon size={14} className={`${iconColor} mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform`} />
                    <div className="flex-1 min-w-0 text-left">
                      {event.message_type === 'truth' || event.message_type === 'dare' ? (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase ${event.message_type === 'truth' ? 'text-blue-400' : 'text-orange-400'
                              }`}>
                              {event.message_type}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              by {event.profiles?.username}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed break-words line-clamp-2">
                            {event.content}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-300 leading-relaxed break-words">
                          {event.content}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1">
                        {new Date(event.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity size={32} className="text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No activity yet</p>
            <p className="text-[10px] text-slate-600 mt-1">Events will appear here</p>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="p-4 border-t border-slate-800/50 bg-slate-900/50">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-2xl font-black text-white">
              {participants.length}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Players</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-red-400">
              {gameEvents.filter(e => e.message_type === 'truth' || e.message_type === 'dare').length}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Rounds</p>
          </div>
        </div>
      </div>
    </aside >
  );
};
