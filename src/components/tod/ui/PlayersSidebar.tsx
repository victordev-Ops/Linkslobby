// src/components/tod/ui/PlayersSidebar.tsx
import {
  Users, Crown, Target, MessageCircle, Activity, Flame, Sparkles, Play,
  StopCircle, UserPlus, Check, X, Ban, ShieldOff, MoreVertical, LogOut,
  ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { showAppSuccess, showAppError } from '@/components/AppToast';
import { sendFriendRequest } from '@/actions/friends';
import VerifiedBadge from '@/components/VerifiedBadge';
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
  currentUserId?: string;
}

const ACTIVITY_PAGE_SIZE_OPTIONS = [5, 8, 15] as const;
const DEFAULT_ACTIVITY_PAGE_SIZE = 8;

// Players list gets its own scroll cap so a big lobby can't push the
// Banned/Requests sections or the footer out of view.
const PLAYERS_LIST_MAX_HEIGHT = 'max-h-[22rem]';

// Relative "last active" label, matching DirectMessageClient's formatLastSeen
// so a player's status reads the same way here as it does in DMs.
function formatLastSeen(dateStr: string): string {
  const diffInSeconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
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
  lobbyName,
  currentUserId
}: PlayersSidebarProps) => {
  const router = useRouter();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'players' | 'activity'>('players');
  const [showRequests, setShowRequests] = useState(true);
  const [showBanned, setShowBanned] = useState(false);
  const [activityPage, setActivityPage] = useState(0);
  const [activityPageSize, setActivityPageSize] = useState<number>(DEFAULT_ACTIVITY_PAGE_SIZE);

  // Force a re-render every 30s so "Active Xm ago" labels stay fresh without
  // needing a new participants fetch or presence event.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const joinedParticipants = participants.filter(p => p.status === 'joined');

  // Newest activity first — that's what people actually want to scan.
  const gameEvents = useMemo(
    () =>
      messages
        .filter(m => m.message_type === 'system' || m.message_type === 'truth' || m.message_type === 'dare')
        .slice()
        .reverse(),
    [messages]
  );

  const roundsCount = useMemo(
    () => gameEvents.filter(e => e.message_type === 'truth' || e.message_type === 'dare').length,
    [gameEvents]
  );

  const totalActivityPages = Math.max(1, Math.ceil(gameEvents.length / activityPageSize));

  // Keep the page in range if the underlying event list shrinks/grows,
  // or if the page size itself changes.
  useEffect(() => {
    if (activityPage > totalActivityPages - 1) setActivityPage(Math.max(0, totalActivityPages - 1));
  }, [totalActivityPages, activityPage]);

  const paginatedEvents = gameEvents.slice(
    activityPage * activityPageSize,
    activityPage * activityPageSize + activityPageSize
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
      const element = document.getElementById(`message-${messageId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-red-500', 'ring-offset-2', 'ring-offset-slate-950');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2', 'ring-offset-slate-950');
        }, 2000);
      }
    }
  };

  return (
    <aside className={`w-64 flex-shrink-0 border-r border-slate-800/50 bg-slate-900/30 backdrop-blur-sm flex flex-col overflow-hidden ${className}`}>
      {/* Lobby Name Header */}
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/40 flex-shrink-0">
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

      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center gap-1 p-2 border-b border-slate-800/50 bg-slate-900/40">
        <button
          onClick={() => setActiveTab('players')}
          className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
            activeTab === 'players'
              ? 'bg-red-500/15 text-red-300 border border-red-500/30'
              : 'text-slate-400 border border-transparent hover:bg-slate-800/50'
          }`}
        >
          <Users size={14} />
          Players
          <span className="text-[10px] text-slate-500">({joinedParticipants.length})</span>
          {isHost && pendingRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
            activeTab === 'activity'
              ? 'bg-red-500/15 text-red-300 border border-red-500/30'
              : 'text-slate-400 border border-transparent hover:bg-slate-800/50'
          }`}
        >
          <Activity size={14} />
          Activity
          <span className="text-[10px] text-slate-500">({gameEvents.length})</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'players' && (
          <div className="p-4 space-y-4">
            {/* Join Requests — collapsible, open by default when something needs action */}
            {isHost && pendingRequests.length > 0 && (
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 overflow-hidden">
                <button
                  onClick={() => setShowRequests(v => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus size={16} className="text-orange-400" />
                    <span className="text-white font-bold text-xs uppercase tracking-wide">
                      Requests ({pendingRequests.length})
                    </span>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showRequests ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {showRequests && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-2">
                        {pendingRequests.map((req) => (
                          <div key={req.user_id} className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-white">
                                  {(req.profiles?.username || 'U')[0].toUpperCase()}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-slate-200 truncate">
                                {req.profiles?.username}
                              </span>
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Players list — capped height with its own scroll so a big
                lobby can't crowd out Requests/Banned or the footer below */}
            <div className={`space-y-2 overflow-y-auto pr-1 ${PLAYERS_LIST_MAX_HEIGHT}`}>
              {joinedParticipants.map((participant) => {
                const isParticipantHost = participant.user_id === hostId;
                const isTarget = participant.user_id === currentTargetId;
                const isAsker = participant.user_id === currentAskerId;
                const isOnline = onlineUsers.has(participant.user_id);
                const hasTurn = participant.has_gone_this_round;
                const isSelf = currentUserId != null && participant.user_id === currentUserId;

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
                      <div className={`w-8 h-8 rounded-full overflow-hidden flex-shrink-0 relative ${isTarget
                        ? 'ring-2 ring-red-500/50'
                        : isAsker
                          ? 'ring-2 ring-blue-500/50'
                          : ''
                        }`}>
                        {participant.profiles?.avatar_url ? (
                          <img src={participant.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${isTarget
                              ? 'bg-gradient-to-br from-red-500 to-orange-500'
                              : isAsker
                                ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                                : 'bg-slate-700'
                            }`}>
                            <span className="text-white font-bold text-xs uppercase">
                              {participant.profiles?.username?.slice(0, 2) || '??'}
                            </span>
                          </div>
                        )}
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 shadow-sm" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isTarget ? 'text-white' : isAsker ? 'text-blue-100' : 'text-slate-300'}`}>
                            {isSelf ? 'You' : (participant.profiles?.username || 'Unknown')}
                          </p>
                          {participant.profiles?.is_pro && <VerifiedBadge size={14} />}
                        </div>
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
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-slate-600'}`} />
                          <p className={`text-[10px] font-medium truncate ${isOnline ? 'text-green-400/80' : 'text-slate-500'}`}>
                            {isOnline
                              ? 'Active now'
                              : participant.profiles?.last_active_at
                                ? `Active ${formatLastSeen(participant.profiles.last_active_at)}`
                                : 'Offline'}
                          </p>
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === participant.id ? null : participant.id);
                          }}
                          className="ml-1 w-6 h-6 rounded hover:bg-slate-800 flex items-center justify-center transition text-slate-400 hover:text-white"
                        >
                          <MoreVertical size={14} />
                        </button>

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
                                    const identifier = participant.profiles?.username || participant.user_id;
                                    router.push(`/u/${identifier}`);
                                    setActiveMenuId(null);
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors text-left w-full"
                                >
                                  <Users size={14} className="text-blue-400" />
                                  Profile
                                </button>

                                {!isSelf && (
                                  <button
                                    onClick={async () => {
                                      setActiveMenuId(null);
                                      const result = await sendFriendRequest(participant.user_id);
                                      if (result.success) {
                                        showAppSuccess('Friend request sent!');
                                      } else {
                                        showAppError(result.error || 'Failed to send request');
                                      }
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors text-left w-full"
                                  >
                                    <UserPlus size={14} className="text-purple-400" />
                                    Add Friend
                                  </button>
                                )}

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

            {/* Banned Participants — collapsible, closed by default so it doesn't crowd active players */}
            {isHost && bannedParticipants.length > 0 && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden">
                <button
                  onClick={() => setShowBanned(v => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Ban size={16} className="text-red-400" />
                    <span className="text-white font-bold text-xs uppercase tracking-wide">
                      Banned ({bannedParticipants.length})
                    </span>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showBanned ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {showBanned && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-2">
                        {bannedParticipants.map((banned) => (
                          <div key={banned.user_id} className="bg-slate-800/50 p-2 rounded-lg border border-red-500/30">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[10px] font-bold text-red-400">
                                    {(banned.profiles?.username || 'U')[0].toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-slate-200 truncate">
                                  {banned.profiles?.username}
                                </span>
                              </div>
                              <Ban size={12} className="text-red-400 flex-shrink-0" />
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-4 flex flex-col h-full">
            {gameEvents.length > 0 ? (
              <>
                <div className="space-y-2">
                  {paginatedEvents.map((event) => {
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
                                  <span className={`text-[10px] font-bold uppercase ${event.message_type === 'truth' ? 'text-blue-400' : 'text-orange-400'}`}>
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

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/50">
                  {totalActivityPages > 1 ? (
                    <>
                      <button
                        onClick={() => setActivityPage(p => Math.max(0, p - 1))}
                        disabled={activityPage === 0}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-700/50 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        Page {activityPage + 1} of {totalActivityPages}
                      </span>
                      <button
                        onClick={() => setActivityPage(p => Math.min(totalActivityPages - 1, p + 1))}
                        disabled={activityPage === totalActivityPages - 1}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-700/50 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-600">{gameEvents.length} event{gameEvents.length === 1 ? '' : 's'}</span>
                  )}

                  {/* Per-page size */}
                  <div className="flex items-center gap-1">
                    {ACTIVITY_PAGE_SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setActivityPageSize(size);
                          setActivityPage(0);
                        }}
                        className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${
                          activityPageSize === size
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'text-slate-500 border border-transparent hover:bg-slate-800'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Activity size={32} className="text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No activity yet</p>
                <p className="text-[10px] text-slate-600 mt-1">Events will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="p-4 border-t border-slate-800/50 bg-slate-900/50 flex-shrink-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-2xl font-black text-white">
              {joinedParticipants.length}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Players</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-red-400">
              {roundsCount}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Rounds</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
