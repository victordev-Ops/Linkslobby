import { Users, UserPlus, ArrowRight } from 'lucide-react';

interface GameHeaderProps {
  playersCount: number;
  status: 'waiting' | 'active' | 'finished';
  selectedMode?: 'truth' | 'dare';
  askerUsername?: string;
  targetUsername?: string;
  onInvite: () => void;
}

export const GameHeader = ({
  playersCount,
  status,
  selectedMode,
  askerUsername,
  targetUsername,
  onInvite
}: GameHeaderProps) => {
  return (
    <header className="flex-shrink-0 px-4 py-3 backdrop-blur-xl bg-slate-900/50 border-b border-slate-800/50">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Players count */}
        <div className="flex items-center gap-2 text-sm">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Users size={16} className="text-white" />
          </div>
          <span className="text-white font-bold hidden sm:inline">{playersCount} Players</span>
          <span className="text-white font-bold sm:hidden">{playersCount}</span>
        </div>

        {/* Game Status */}
        {status === 'active' && selectedMode && askerUsername && targetUsername && (
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <div className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 font-bold border border-orange-500/30">
              {askerUsername}
            </div>
            <ArrowRight size={16} className="text-slate-600 hidden sm:block" />
            <div className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 font-bold border border-red-500/30">
              {targetUsername}
            </div>
          </div>
        )}

        {/* Invite button */}
        <button
          onClick={onInvite}
          className="px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 flex items-center gap-1.5"
        >
          <UserPlus size={14} />
          <span className="hidden sm:inline">Invite</span>
        </button>
      </div>
    </header>
  );
};
                           
