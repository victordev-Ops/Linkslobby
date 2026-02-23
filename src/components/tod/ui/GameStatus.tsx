import { ArrowRight, Skull, Flame, Clock, MessageSquare, Target } from 'lucide-react';

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

  if (!askerUsername || !targetUsername) {
    return (
      <div className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-bold flex items-center gap-1.5">
        <Clock size={12} />
        <span className="hidden sm:inline">Starting...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="px-2 sm:px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300/80 text-[10px] sm:text-xs font-bold flex items-center gap-1.5 truncate max-w-[90px] sm:max-w-none shadow-sm">
        <MessageSquare size={10} className="text-orange-400 shrink-0" />
        <span className="truncate">{askerUsername}</span>
      </div>

      <div className="flex items-center gap-1 mx-0.5">
        {selectedMode ? (
          <>
            <ArrowRight size={12} className="text-slate-600 hidden sm:block" />
            {selectedMode === 'truth' ? (
              <Skull size={12} className="text-orange-400" />
            ) : (
              <Flame size={12} className="text-red-400" />
            )}
          </>
        ) : (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/50 border border-slate-700/30 animate-pulse text-[8px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-black italic">
            Pick
          </div>
        )}
      </div>

      <div className="px-2 sm:px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300/80 text-[10px] sm:text-xs font-bold flex items-center gap-1.5 truncate max-w-[90px] sm:max-w-none shadow-sm">
        <Target size={10} className="text-red-400 shrink-0" />
        <span className="truncate">{targetUsername}</span>
      </div>
    </div>
  );
};
