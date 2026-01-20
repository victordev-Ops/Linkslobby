// src/components/tod/ui/PlayersSidebar.tsx
import { Users, Crown, Target, MessageCircle, Activity, Flame, Sparkles, Play, StopCircle } from 'lucide-react';

interface Participant {
  user_id: string;
  has_gone_this_round: boolean;
  profiles?: { username: string };
}

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
}

export const PlayersSidebar = ({
  participants,
  messages,
  currentTargetId,
  hostId,
  className = '',
  onActivityClick
}: PlayersSidebarProps) => {
  
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
            const isHost = participant.user_id === hostId;
            const isTarget = participant.user_id === currentTargetId;
            const hasTurn = participant.has_gone_this_round;
            
            return (
              <div
                key={participant.user_id}
                className={`flex items-center justify-between p-2 rounded-lg transition-all ${
                  isTarget
                    ? 'bg-red-500/20 border border-red-500/50'
                    : 'bg-slate-800/30 border border-slate-700/30'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isTarget
                      ? 'bg-gradient-to-br from-red-500 to-orange-500'
                      : 'bg-slate-700'
                  }`}>
                    <span className="text-white font-bold text-xs uppercase">
                      {participant.profiles?.username?.slice(0, 2) || '??'}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${
                      isTarget ? 'text-white' : 'text-slate-300'
                    }`}>
                      {participant.profiles?.username || 'Unknown'}
                    </p>
                    {hasTurn && !isTarget && (
                      <p className="text-xs text-slate-500">Played</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {isHost && (
                    <Crown size={14} className="text-amber-400" />
                  )}
                  {isTarget && (
                    <Target size={14} className="text-red-400 animate-pulse" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                            <span className={`text-[10px] font-bold uppercase ${
                              event.message_type === 'truth' ? 'text-blue-400' : 'text-orange-400'
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
    </aside>
  );
};
