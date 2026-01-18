
"use client";

import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2, AlertCircle, Users, UserPlus, Sparkles, Play, StopCircle, X, ArrowLeft, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGameLogic } from "./hooks/useGameLogic";
import { PlayersSidebar } from "./ui/PlayersSidebar";
import { ModeSelector } from "./ui/ModeSelector";
import { MessageBubble } from "./ui/MessageBubble";
import { ChatInput } from "./ui/ChatInput";
import { WaitingRoom } from "./ui/WaitingRoom";
import { NextRoundButton } from "./ui/NextRoundButton";
import { GameStatus } from "./ui/GameStatus";

export default function TODGameClient({ lobbyId }: { lobbyId: string }) {
  const { profile } = useAuth();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    lobby, participants, messages, isLoading, errorStatus, timeRemaining,
    sendMessage, selectMode, startGame, startNextRound, endGame, uploadImage, cleanup
  } = useGameLogic(lobbyId, profile?.id);

  const isTarget = profile?.id === lobby?.current_target_id;
  const isAsker = profile?.id === lobby?.current_asker_id;
  const isHost = profile?.id === lobby?.host_id;

  // Logic to check if user has already acted this turn
  const hasUserActedThisTurn = () => {
    if (!lobby?.turn_started_at) return false;
    return messages.some(m => 
      m.user_id === profile?.id && 
      new Date(m.created_at) > new Date(lobby.turn_started_at!) &&
      (m.message_type === 'chat' || m.message_type === 'truth' || m.message_type === 'dare')
    );
  };

  const canSendMessage = () => {
    if (lobby?.status !== 'active') return true;
    if (!lobby.selected_mode) return false;
    
    // If no question yet: Only Asker can type, provided they haven't sent the question yet
    if (!lobby.current_question) return isAsker && !hasUserActedThisTurn();
    
    // If question is asked: Only Target can type, provided they haven't answered yet
    return isTarget && !hasUserActedThisTurn();
  };

  const getPlaceholder = () => {
    if (lobby?.status !== 'active') return "Chat...";
    if (!lobby.selected_mode) return "Waiting for mode...";
    if (!lobby.current_question) return isAsker ? "Ask your question..." : "Waiting for asker...";
    if (isTarget) return hasUserActedThisTurn() ? "Answer sent!" : "Type your answer...";
    return "Waiting for answer...";
  };

  const handleSendMessage = async (content: string, imageUrl: string | null) => {
    const type = (isAsker && !lobby?.current_question) ? lobby!.selected_mode! : 'chat';
    await sendMessage(content, imageUrl, type);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-red-500" /></div>;

  const targetUser = participants.find(p => p.user_id === lobby?.current_target_id);
  const askerUser = participants.find(p => p.user_id === lobby?.current_asker_id);

  return (
    <div className="h-screen bg-slate-950 flex flex-col text-white">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <button onClick={() => router.push('/tod')}><ArrowLeft /></button>
        <GameStatus status={lobby!.status} selectedMode={lobby!.selected_mode} askerUsername={askerUser?.profiles?.username} targetUsername={targetUser?.profiles?.username} />
        {timeRemaining !== null && <div className="text-red-400 font-bold"><Timer className="inline mr-1" size={16}/>{timeRemaining}s</div>}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <PlayersSidebar className="hidden lg:flex w-64" participants={participants} messages={messages} currentTargetId={lobby?.current_target_id} hostId={lobby?.host_id} />
        
        <main className="flex-1 flex flex-col">
          <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {lobby?.status === 'waiting' && <WaitingRoom isHost={isHost} playersCount={participants.length} onStartGame={startGame} />}
            {messages.map(m => <MessageBubble key={m.id} message={m} isOwn={m.user_id === profile?.id} />)}
            <div ref={messagesEndRef} />
          </div>

          {lobby?.status === 'active' && !lobby.selected_mode && (
            <div className="p-4 bg-slate-900 border-t border-slate-800">
              <ModeSelector isTarget={isTarget} targetUsername={targetUser?.profiles?.username} onSelectMode={selectMode} timeRemaining={timeRemaining} />
            </div>
          )}

          <ChatInput 
            canSend={canSendMessage()} 
            placeholder={getPlaceholder()} 
            isUploading={isUploading} 
            onSend={handleSendMessage} 
            onUploadImage={async (f) => { setIsUploading(true); const url = await uploadImage(f); setIsUploading(false); return url; }} 
          />
        </main>
      </div>
    </div>
  );
}
