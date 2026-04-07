// src/components/tod/ui/WaitingRoom.tsx
import { Play, Users, Clock } from 'lucide-react';

interface WaitingRoomProps {
  isHost: boolean;
  playersCount: number;
  onStartGame: () => void;
}

export const WaitingRoom = ({ isHost, playersCount, onStartGame }: WaitingRoomProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 min-h-[50vh]">
      <div className="max-w-md w-full">
        {/* Animated Icon */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-orange-500 rounded-full animate-pulse opacity-50" />
          <div className="absolute inset-2 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-2xl">
            <Users size={40} className="text-white" />
          </div>
        </div>

        {/* Status */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3 italic">
            Waiting Room
          </h2>
          <p className="text-slate-400 text-sm md:text-base mb-4">
            Share the invite link with friends to join
          </p>
          
          {/* Player Count Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/80 border border-slate-700 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-white font-bold">{playersCount} Player{playersCount !== 1 ? 's' : ''} Connected</span>
          </div>
        </div>

        {/* Instructions */}
        {isHost ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-white text-center font-semibold mb-3">
                You're the host! Start the game when everyone's ready.
              </p>
              <button
                onClick={onStartGame}
                disabled={playersCount < 2}
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={20} />
                {playersCount < 2 ? 'Need 2+ Players' : 'Start Game'}
              </button>
            </div>
            
            <p className="text-xs text-slate-500 text-center">
              Minimum 2 players required to start
            </p>
          </div>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm text-center">
            <Clock size={32} className="text-slate-400 mx-auto mb-3" />
            <p className="text-white font-semibold mb-2">
              Waiting for host to start...
            </p>
            <p className="text-slate-400 text-sm">
              The game will begin shortly
            </p>
          </div>
        )}

        {/* How to Play */}
        <div className="mt-8 space-y-3">
          <h3 className="text-white font-bold text-sm uppercase tracking-wide text-center mb-4">
            How to Play
          </h3>
          <div className="space-y-2">
            {[
              'Players take turns being asked truth or dare',
              'Swipe the question card to reply with your answer',
              'The answer will be directly linked to the question',
              'Have fun and keep it friendly! 🎉'
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-400 font-bold text-xs">{idx + 1}</span>
                </div>
                <p className="text-slate-300 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
