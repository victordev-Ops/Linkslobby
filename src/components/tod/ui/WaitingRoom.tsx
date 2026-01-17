import { Sparkles } from 'lucide-react';

interface WaitingRoomProps {
  isHost: boolean;
  playersCount: number;
  onStartGame: () => void;
}

export const WaitingRoom = ({ isHost, playersCount, onStartGame }: WaitingRoomProps) => {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
        <Sparkles size={32} className="text-red-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Waiting for Players</h3>
      <p className="text-slate-400 text-sm mb-6">Invite friends to start the game!</p>
      {isHost && playersCount >= 2 && (
        <button
          onClick={onStartGame}
          className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-red-500/50 transition-all active:scale-95"
        >
          START GAME
        </button>
      )}
    </div>
  );
};
