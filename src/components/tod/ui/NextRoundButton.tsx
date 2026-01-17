// NextRoundButton.tsx
import { ArrowRight } from 'lucide-react';

interface NextRoundButtonProps {
  onNextRound: () => void;
}

export const NextRoundButton = ({ onNextRound }: NextRoundButtonProps) => {
  return (
    <div className="flex justify-center pt-6 px-4">
      <button
        onClick={onNextRound}
        className="group bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 sm:px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-red-500/50 transition-all active:scale-95"
      >
        NEXT ROUND
        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
};
