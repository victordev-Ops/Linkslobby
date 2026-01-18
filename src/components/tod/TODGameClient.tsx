// src/components/tod/TODGameClient.tsx
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

interface TODGameClientProps {
  lobbyId: string;
}

export default function TODGameClient({ lobbyId }: TODGameClientProps) {
  const { profile } = useAuth();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const previousMessageCount = useRef(0);

  const {
    lobby,
    participants,
    messages,
    isLoading,
    errorStatus,
    timeRemaining,
    sendMessage,
    selectMode,
    startGame,
    startNextRound,
    endGame,
    uploadImage,
    cleanup
  } = useGameLogic(lobbyId, profile?.id);

  const scrollToBottom = (force = false) => {
    if (!messagesContainerRef.current || !messagesEndRef.current) return;
    const container = messagesContainerRef.current;
    if (force || (container.scrollHeight - container.scrollTop - container.clientHeight < 150)) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (messages.length > previousMessageCount.current) {
      scrollToBottom(false);
      previousMessageCount.current = messages.length;
    }
  }, [messages.length]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const isTarget = profile?.id === lobby?.current_target_id;
  const isAsker = profile?.id === lobby?.current_asker_id;
  const isHost = profile?.id === lobby?.host_id;

  const canSendMessage = () => {
    if (lobby?.status === 'waiting' || lobby?.status === 'finished') return true;
    if (lobby?.status === 'active') {
      if (!lobby.selected_mode) return false;
      if (!lobby.current_question) return isAsker;
      if (lobby.current_question) {
        const hasAnswered = messages.some(m => 
          m.user_id === profile?.id && 
          new Date(m.created_at) > new Date(lobby.turn_started_at || 0) &&
          m.message_type === 'chat'
        );
        return isTarget && !hasAnswered;
      }
    }
    return false;
  };

  const handleSendMessage = async (content: string, imageUrl: string | null) => {
    const messageType: 'chat' | 'truth' | 'dare' | 'system' = 
      (isAsker && lobby?.selected_mode && !lobby?.current_question)
        ? lobby.selected_mode
        : 'chat';

    await sendMessage(content, imageUrl, messageType);
    setTimeout(() => scrollToBottom(true), 100);
  };

  const handleSelectMode = async (mode: 'truth' | 'dare') => {
    await selectMode(mode);
  };

  const handleLeaveLobby = () => {
    cleanup();
    router.push('/tod');
  };

  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
      <Loader2 className="w-12 h-12 animate-spin text-red-400" />
    </div>
  );

  if (errorStatus || !lobby) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
      <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-white">Error</h2>
      <button onClick={handleLeaveLobby} className="mt-4 bg-red-500 text-white px-8 py-2 rounded-full">Back</button>
    </div>
  );

  const targetUser = participants.find(p => p.user_id === lobby.current_target_id);
  const askerUser = participants.find(p => p.user_id === lobby.current_asker_id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950 to-slate-950 flex flex-col overflow-hidden">
      <header className="px-4 py-3 bg-slate-900/50 border-b border-slate-800/50 flex items-center justify-between">
        <button onClick={handleLeaveLobby} className="text-white"><ArrowLeft /></button>
        <GameStatus 
          status={lobby.status} 
          selectedMode={lobby.selected_mode} 
          askerUsername={askerUser?.profiles?.username} 
          targetUsername={targetUser?.profiles?.username} 
        />
        {lobby.status === 'active' && timeRemaining !== null && (
          <div className="text-red-400 font-bold flex items-center gap-1"><Timer size={14}/> {timeRemaining}s</div>
        )}
      </header>

      <div className="flex-1 flex max-w-6xl mx-auto w-full overflow-hidden">
        <PlayersSidebar 
          className="hidden lg:flex" 
          participants={participants} 
          messages={messages} 
          currentTargetId={lobby.current_target_id} 
          hostId={lobby.host_id} 
        />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {lobby.status === 'waiting' && <WaitingRoom isHost={isHost} playersCount={participants.length} onStartGame={startGame} />}
            {messages.map((msg) => <MessageBubble key={msg.id} message={msg} isOwn={msg.user_id === profile?.id} />)}
            <div ref={messagesEndRef} />
          </div>

          {lobby.status === 'active' && !lobby.selected_mode && (
            <div className="p-4 border-t border-slate-800">
              <ModeSelector 
                isTarget={isTarget} 
                targetUsername={targetUser?.profiles?.username} 
                onSelectMode={handleSelectMode} // Now uses the improved local handler
                timeRemaining={timeRemaining} 
              />
            </div>
          )}

          <ChatInput 
            canSend={canSendMessage()} 
            placeholder={isTarget && lobby.current_question ? "Type your answer..." : "Wait for your turn..."} 
            isUploading={isUploading} 
            onSend={handleSendMessage} 
            onUploadImage={uploadImage} 
          />
        </main>
      </div>
    </div>
  );
}
