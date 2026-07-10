// src/components/tod/ui/ModeSelector.tsx
// Mobile-first: stacks full-width on small screens, uses the Dices icon
// uniformly with the rest of the game's truth/dare iconography.

import { Skull, Flame, Clock, Timer, Dices } from 'lucide-react';

interface ModeSelectorProps {
  isTarget: boolean;
  targetUsername?: string;
  onSelectMode: (mode: 'truth' | 'dare') => void;
  timeRemaining?: number | null;
}

export const ModeSelector = ({ isTarget, targetUsername, onSelectMode, timeRemaining }: ModeSelectorProps) => {
  if (!isTarget) {
    return (
      <div className="flex flex-col items-center justify-center py-4 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Dices className="w-5 h-5 text-orange-400 animate-spin [animation-duration:2.5s]" />
          <p className="text-slate-300 text-sm font-semibold text-center">
            Waiting for <span className="text-red-400">{targetUsername}</span> to choose...
          </p>
        </div>

        {timeRemaining !== null && timeRemaining !== undefined && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border mt-2 ${
            timeRemaining <= 10
              ? 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse'
              : 'bg-slate-800/80 border-slate-700/50 text-slate-300'
          }`}>
            <Timer size={14} />
            <span className="text-xs font-bold">{timeRemaining}s remaining</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-4 border-2 border-dashed border-red-500/30 backdrop-blur-sm">
      <div className="flex flex-col items-stretch gap-3">
        {/* Text */}
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <Dices size={18} className="text-red-400 shrink-0" />
          <h3 className="text-lg sm:text-xl font-black text-white italic">
            Your turn! Pick one:
          </h3>

          {timeRemaining !== null && timeRemaining !== undefined && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs ml-auto ${
              timeRemaining <= 10
                ? 'bg-red-500/30 border-red-500/60 text-red-200 animate-pulse'
                : 'bg-slate-800/60 border-slate-700/50 text-slate-300'
            }`}>
              <Timer size={12} />
              <span className="font-bold">{timeRemaining}s</span>
            </div>
          )}
        </div>

        {/* Buttons — full width stack on mobile, side-by-side from sm up */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2.5 sm:gap-3">
          <button
            onClick={() => onSelectMode('truth')}
            className="group flex-1 min-h-[56px] px-6 py-4 bg-orange-500/20 border-2 border-orange-500 text-orange-300 rounded-xl font-black text-base hover:bg-orange-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2 backdrop-blur-sm"
          >
            <Skull className="group-hover:rotate-12 transition-transform w-5 h-5" />
            <span>TRUTH</span>
          </button>

          <button
            onClick={() => onSelectMode('dare')}
            className="group flex-1 min-h-[56px] px-6 py-4 bg-red-500/20 border-2 border-red-500 text-red-300 rounded-xl font-black text-base hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2 backdrop-blur-sm"
          >
            <Flame className="group-hover:animate-bounce w-5 h-5" />
            <span>DARE</span>
          </button>
        </div>
      </div>

      {timeRemaining !== null && timeRemaining !== undefined && timeRemaining <= 10 && (
        <p className="text-xs text-red-400 mt-3 font-semibold text-center">
          ⚠️ Time is running out! Choose quickly!
        </p>
      )}
    </div>
  );
};
