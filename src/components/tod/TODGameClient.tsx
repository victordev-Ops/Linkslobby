"use client";

import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2, AlertCircle, Users, UserPlus, Sparkles, Play, StopCircle } from "lucide-react";
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
  const [isUploading, setIsUploading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    lobby,
    participants,
    messages,
    isLoading,
    errorStatus,
    sendMessage,
    selectMode,
    startGame,
    startNextRound,
    endGame,
    uploadImage
  } = useGameLogic(lobbyId, profile?.id);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link copied! Share with friends 🎉");
  };

  const handleSelectMode = async (mode: 'truth' | 'dare') => {
    await selectMode(mode, profile?.username);
  };

  const handleStartGame = async () => {
    await startGame();
  };

  const handleNextRound = async () => {
    await startNextRound();
  };

  const handleEndGame = async () => {
    await endGame();
  };

  const handleSendMessage = async (content: string, imageUrl: string | null) => {
    const isAsker = profile?.id === lobby?.current_asker_id;
    const messageType = (isAsker && lobby?.selected_mode && !lobby?.current_question)
      ? lobby.selected_mode
      : 'chat';

    await sendMessage(content, imageUrl, messageType, profile?.username);
  };

  const handleUploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    const url = await uploadImage(file);
    setIsUploading(false);
    return url;
  };

  const isTarget = profile?.id === lobby?.current_target_id;
  const isAsker = profile?.id === lobby?.current_asker_id;
  const isHost = profile?.id === lobby?.host_id;

  const canSendMessage = () => {
    if (lobby?.status === 'waiting') return true;
    if (lobby?.status !== 'active') return false;
    if (!lobby?.selected_mode) return false;
    if (lobby?.selected_mode && !lobby?.current_question) return isAsker;
    if (lobby?.current_question) return isTarget;
    return false;
  };

  const getInputPlaceholder = () => {
    if (lobby?.status === 'waiting') return "Chat while waiting...";
    if (!lobby?.selected_mode) return "Waiting for mode selection...";
    if (lobby?.selected_mode && !lobby?.current_question) {
      return isAsker ? `Ask a ${lobby.selected_mode} question...` : "Waiting for question...";
    }
    if (lobby?.current_question) {
      return isTarget ? "Type your answer..." : "Waiting for answer...";
    }
    return "Type a message...";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-red-950 to-slate-950 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-red-400" />
        <p className="text-slate-300 font-semibold animate-pulse">Loading game...</p>
      </div>
    );
  }

  if (errorStatus || !lobby) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-950 via-red-950 to-slate-950">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-white">Lobby Error</h2>
        <p className="text-slate-400 mb-6">{errorStatus || "Game not found."}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-red-500/50 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const targetUser = participants.find(p => p.user_id === lobby.current_target_id);
  const askerUser = participants.find(p => p.user_id === lobby.current_asker_id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950 to-slate-950 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-500 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        {/* Top Header */}
        <header className="flex-shrink-0 px-4 py-3 backdrop-blur-xl bg-slate-900/50 border-b border-slate-800/50">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="lg:hidden w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg"
            >
              <Users size={16} className="text-white" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white border-2 border-slate-900">
                {participants.length}
              </span>
            </button>

            <div className="hidden lg:flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
                <Users size={16} className="text-white" />
              </div>
              <span className="text-white font-bold">{participants.length} Players</span>
            </div>

            <GameStatus
              status={lobby.status}
              selectedMode={lobby.selected_mode}
              askerUsername={askerUser?.profiles?.username}
              targetUsername={targetUser?.profiles?.username}
            />

            <div className="flex items-center gap-2">
              {isHost && lobby.status === 'active' && (
                <button
                  onClick={handleEndGame}
                  className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-white text-xs font-bold hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <StopCircle size={14} />
                  <span className="hidden sm:inline">End</span>
                </button>
              )}
              <button
                onClick={copyInviteLink}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <UserPlus size={14} />
                <span className="hidden sm:inline">Invite</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex max-w-6xl mx-auto w-full">
          {/* Mobile Sidebar Overlay */}
          {showSidebar && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setShowSidebar(false)}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-80 bg-slate-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <PlayersSidebar
                  participants={participants}
                  messages={messages}
                  currentTargetId={lobby.current_target_id}
                  hostId={lobby.host_id}
                  onClose={() => setShowSidebar(false)}
                />
              </div>
            </div>
          )}

          {/* Desktop Sidebar */}
          <PlayersSidebar
            participants={participants}
            messages={messages}
            currentTargetId={lobby.current_target_id}
            hostId={lobby.host_id}
            className="hidden lg:block"
          />

          {/* Chat Area */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {lobby.status === 'waiting' && (
                <WaitingRoom
                  isHost={isHost}
                  playersCount={participants.length}
                  onStartGame={handleStartGame}
                />
              )}

              {lobby.status === 'active' && !lobby.selected_mode && (
                <ModeSelector
                  isTarget={isTarget}
                  targetUsername={targetUser?.profiles?.username}
                  onSelectMode={handleSelectMode}
                />
              )}

              {lobby.status === 'active' && lobby.selected_mode && messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.user_id === profile?.id}
                />
              ))}

              {lobby.status === 'active' && lobby.current_question && isHost && (
                <NextRoundButton onNextRound={handleNextRound} />
              )}

              {lobby.status === 'finished' && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                    <Sparkles size={32} className="text-red-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Game Ended!</h3>
                  <p className="text-slate-400 text-sm mb-6">Thanks for playing!</p>
                  {isHost && (
                    <button
                      onClick={handleStartGame}
                      className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 inline-flex items-center gap-2"
                    >
                      <Play size={20} />
                      Play Again
                    </button>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <ChatInput
              canSend={canSendMessage()}
              placeholder={getInputPlaceholder()}
              isUploading={isUploading}
              onSend={handleSendMessage}
              onUploadImage={handleUploadImage}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
