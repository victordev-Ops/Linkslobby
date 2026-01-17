// src/components/tod/ui/PlayerSidebar.tsx

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
  className?: string; // <--- ENSURE THIS IS HERE
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
      {/* ... rest of your component code ... */}
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
      {/* ... rest of the component ... */}
    </aside>
  );
};
