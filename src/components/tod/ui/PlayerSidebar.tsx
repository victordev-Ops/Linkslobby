import { Sparkles, Flame, Crown, CheckCircle2, Skull, X } from 'lucide-react';

interface Participant {
  user_id: string;
  has_gone_this_round: boolean;
  profiles?: { username: string };
}

interface Message {
  id: string;
  content: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system';
}

interface PlayersSidebarProps {
  participants: Participant[];
  messages: Message[];
  currentTargetId?: string;
  hostId: string;
  onClose?: () => void;
  className?: string;
}

export const PlayersSidebar = ({
  participants,
  messages,
  currentTargetId,
  hostId,
  onClose,
  className = ''
}: PlayersSidebarProps) => {
  const gameEvents = messages
    .filter(m => m.message_type === 'system' || m.message_type === 'truth' || m.message_type === 'dare')
    .slice(-10);

  return (
    <aside className={`w-64 flex-shrink-0 p-4 overflow-y-auto ${className}`}>
      {onClose && (
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <h2 className="text-lg font-bold text-white">Game Info</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition"
          >
            <X size={16} className="text-white" />
          </button>
        </div>
      )}

      {/* Players List */}
      <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-4 mb-4 border border-slate-800/50">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-2">
          <Sparkles size={12} className="text-orange-400" />
          Players
        </h3>
        <div className="space-y-2">
          {participants.map((p) => (
            <div
              key={p.user_id}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                p.user_id === currentTargetId
                  ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30'
                  : 'bg-slate-800/30'
              }`}
            >
              {p.user_id === hostId && <Crown size={12} className="text-amber-400" />}
              <span className="text-sm font-semibold text-white truncate flex-1">
                {p.profiles?.username}
              </span>
              {p.has_gone_this_round && <CheckCircle2 size={14} className="text-green-400" />}
            </div>
          ))}
        </div>
      </div>

      {/* Game Log */}
      <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-4 border border-slate-800/50 max-h-[400px] overflow-y-auto">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-2">
          <Flame size={12} className="text-red-400" />
          Activity
        </h3>
        <div className="space-y-2">
          {gameEvents.map((msg) => (
            <div
              key={msg.id}
              className={`p-2.5 rounded-lg text-xs ${
                msg.message_type === 'system'
                  ? 'bg-slate-800/50 text-slate-300'
                  : msg.message_type === 'truth'
                  ? 'bg-orange-500/10 text-orange-300 border border-orange-500/20'
                  : 'bg-red-500/10 text-red-300 border border-red-500/20'
              }`}
            >
              {msg.message_type !== 'system' && (
                <div className="flex items-center gap-1 mb-1">
                  {msg.message_type === 'truth' ? <Skull size={10} /> : <Flame size={10} />}
                  <span className="font-bold uppercase opacity-70" style={{ fontSize: '9px' }}>
                    {msg.message_type}
                  </span>
                </div>
              )}
              <p className="font-medium leading-snug">
                {msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content}
              </p>
            </div>
          ))}
          {gameEvents.length === 0 && (
            <p className="text-slate-500 text-center py-6 text-xs italic">No activity yet</p>
          )}
        </div>
      </div>
    </aside>
  );
};
