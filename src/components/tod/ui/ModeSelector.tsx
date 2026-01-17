// ModeSelector.tsx
import { Skull, Flame, Clock } from 'lucide-react';

interface ModeSelectorProps {
  isTarget: boolean;
  targetUsername?: string;
  onSelectMode: (mode: 'truth' | 'dare') => void;
}

export const ModeSelector = ({ isTarget, targetUsername, onSelectMode }: ModeSelectorProps) => {
  if (!isTarget) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mb-4 border border-orange-500/30">
          <Clock className="w-8 h-8 text-orange-400 animate-pulse" />
        </div>
        <p className="text-slate-300 text-base sm:text-lg font-semibold text-center">
          Waiting for <span className="text-red-400">{targetUsername}</span> to choose...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-3xl p-6 sm:p-8 text-center border-2 border-dashed border-red-500/30 backdrop-blur-sm mx-auto max-w-md">
      <h3 className="text-2xl sm:text-3xl font-black text-white mb-6 italic">
        Your turn! Pick one...
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button
          onClick={() => onSelectMode('truth')}
          className="group px-4 sm:px-6 py-6 sm:py-8 bg-orange-500/20 border-2 border-orange-500 text-orange-300 rounded-2xl font-black text-base sm:text-lg hover:bg-orange-500 hover:text-white transition-all active:scale-95 flex flex-col items-center justify-center gap-3 backdrop-blur-sm"
        >
          <Skull className="group-hover:rotate-12 transition-transform w-8 h-8 sm:w-10 sm:h-10" />
          <span>TRUTH</span>
        </button>
        <button
          onClick={() => onSelectMode('dare')}
          className="group px-4 sm:px-6 py-6 sm:py-8 bg-red-500/20 border-2 border-red-500 text-red-300 rounded-2xl font-black text-base sm:text-lg hover:bg-red-500 hover:text-white transition-all active:scale-95 flex flex-col items-center justify-center gap-3 backdrop-blur-sm"
        >
          <Flame className="group-hover:animate-bounce w-8 h-8 sm:w-10 sm:h-10" />
          <span>DARE</span>
        </button>
      </div>
    </div>
  );
};

