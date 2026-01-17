import { ArrowRight, Skull, Flame, Clock } from 'lucide-react';

interface GameStatusProps {
  status: 'waiting' | 'active' | 'finished';
  selectedMode?: 'truth' | 'dare';
  askerUsername?: string;
  targetUsername?: string;
}

export const GameStatus = ({
  status,
  selectedMode,
  askerUsername,
  targetUsername
}: GameStatusProps) => {
  if (status !== 'active') {
    return (
      <div className="flex items-center gap-2">
        <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/50 text-slate-300 text-xs font-bold flex items-center gap-1.5">
          <Clock size={12} />
          <span className="hidden sm:inline">
            {status === 'waiting' ? 'Waiting' : 'Finished'}
          </span>
        </div>
      </div>
    );
  }

  if (!selectedMode || !askerUsername || !targetUsername) {
    return (
      <div className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-bold flex items-center gap-1.5">
        <Clock size={12} />
        <span className="hidden sm:inline">Selecting...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="px-2 sm:px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 text-[10px] sm:text-xs font-bold truncate max-w-[80px] sm:max-w-none">
        {askerUsername}
      </div>
      <ArrowRight size={14} className="text-slate-600 hidden sm:block" />
      {selectedMode === 'truth' ? (
        <Skull size={14} className="text-orange-400 sm:hidden" />
      ) : (
        <Flame size={14} className="text-red-400 sm:hidden" />
      )}
      <div className="px-2 sm:px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] sm:text-xs font-bold truncate max-w-[80px] sm:max-w-none">
        {targetUsername}
      </div>
    </div>
  );
};
