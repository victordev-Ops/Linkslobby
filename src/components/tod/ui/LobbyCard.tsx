import { Users, Clock, Crown, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface LobbyCardProps {
  lobbyId: string;
  playerCount: number;
  status: 'waiting' | 'active' | 'finished';
  isHost: boolean;
  lastActivity: string;
  hostUsername: string;
}

export const LobbyCard = ({
  lobbyId,
  playerCount,
  status,
  isHost,
  lastActivity,
  hostUsername
}: LobbyCardProps) => {
  const getStatusColor = () => {
    switch (status) {
      case 'waiting':
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
      case 'active':
        return 'from-red-500/20 to-orange-500/20 border-red-500/30';
      case 'finished':
        return 'from-slate-500/20 to-slate-600/20 border-slate-500/30';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'waiting':
        return 'Waiting';
      case 'active':
        return 'In Progress';
      case 'finished':
        return 'Finished';
    }
  };

  return (
    <Link href={`/tod/${lobbyId}`}>
      <div
        className={`bg-gradient-to-br ${getStatusColor()} backdrop-blur-md rounded-2xl p-5 border-2 hover:scale-[1.02] transition-all cursor-pointer group`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{playerCount} Players</p>
              <p className="text-xs text-slate-400">{getStatusText()}</p>
            </div>
          </div>
          {isHost && (
            <div className="px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center gap-1">
              <Crown size={12} className="text-amber-400" />
              <span className="text-xs font-bold text-amber-300">Host</span>
            </div>
          )}
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Clock size={12} className="text-slate-400" />
            <span>{new Date(lastActivity).toLocaleString()}</span>
          </div>
          <div className="text-xs text-slate-400">
            Hosted by <span className="font-semibold text-slate-300">{hostUsername}</span>
          </div>
        </div>

        <div className="flex items-center justify-end text-red-400 group-hover:text-red-300 transition-colors">
          <span className="text-sm font-bold mr-2">Join Game</span>
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
};
    
