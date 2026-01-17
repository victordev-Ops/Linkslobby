import { Sparkles, Play } from 'lucide-react';

interface WaitingRoomProps {
  isHost: boolean;
  playersCount: number;
  onStartGame: () => void;
}

export const WaitingRoom = ({ isHost, playersCount, onStartGame }: WaitingRoomProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
        <Sparkles size={32} className="text-red-400" />
      </div>
      <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 text-center">Waiting for Players</h3>
      <p className="text-slate-400 text-sm mb-6 text-center">Invite friends to start the game!</p>
      {isHost && playersCount >= 2 ? (
        <button
          onClick={onStartGame}
          className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 inline-flex items-center gap-2"
        >
          <Play size={20} />
          START GAME
        </button>
      ) : (
        <p className="text-slate-500 text-xs text-center">
          {isHost ? 'Need at least 2 players to start' : 'Waiting for host to start...'}
        </p>
      )}
    </div>
  );
};
