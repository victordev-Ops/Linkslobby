import { Skull, Flame, Clock } from 'lucide-react';

interface ModeSelectorProps {
  isTarget: boolean;
  targetUsername?: string;
  onSelectMode: (mode: 'truth' | 'dare') => void;
}

export const ModeSelector = ({ isTarget, targetUsername, onSelectMode }: ModeSelectorProps) => {
  if (!isTarget) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 text-orange-400 mx-auto mb-4 animate-pulse" />
        <p className="text-slate-300 text-lg font-semibold">
          Waiting for {targetUsername} to choose...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-3xl p-6 sm:p-8 text-center border-2 border-dashed border-red-500/30 backdrop-blur-sm">
      <h3 className="text-2xl sm:text-3xl font-black text-white mb-6 italic">
        Pick your poison...
      </h3>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={() => onSelectMode('truth')}
          className="group px-6 sm:px-8 py-4 bg-orange-500/20 border-2 border-orange-500 text-orange-300 rounded-2xl font-black text-lg hover:bg-orange-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3 backdrop-blur-sm"
        >
          <Skull className="group-hover:rotate-12 transition-transform" size={24} />
          TRUTH
        </button>
        <button
          onClick={() => onSelectMode('dare')}
          className="group px-6 sm:px-8 py-4 bg-red-500/20 border-2 border-red-500 text-red-300 rounded-2xl font-black text-lg hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3 backdrop-blur-sm"
        >
          <Flame className="group-hover:animate-bounce" size={24} />
          DARE
        </button>
      </div>
    </div>
  );
};
      
