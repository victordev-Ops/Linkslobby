"use client";

import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { useGameLogic } from "./hooks/useGameLogic";
import { GameHeader } from "./ui/GameHeader";
import { PlayersSidebar } from "./ui/PlayersSidebar";
import { ModeSelector } from "./ui/ModeSelector";
import { MessageBubble } from "./ui/MessageBubble";
import { ChatInput } from "./ui/ChatInput";
import { WaitingRoom } from "./ui/WaitingRoom";
import { NextRoundButton } from "./ui/NextRoundButton";

interface TODGameClientProps {
  lobbyId: string;
}

export default function TODGameClient({ lobbyId }: TODGameClientProps) {
  const { profile } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    lobby,
    participants,
    messages,
    isLoading,
    errorStatus,
    sendMessage,
    selectMode,
    startNextRound,
    uploadImage
  } = useGameLogic(lobbyId, profile?.id);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper functions
  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link copied! Share with friends 🎉");
  };

  const handleSelectMode = async (mode: 'truth' | 'dare') => {
    await selectMode(mode, profile?.username);
  };

  const handleStartGame = async () => {
    await startNextRound(profile?.username);
  };

  const handleNextRound = async () => {
    await startNextRound(profile?.username);
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

  // Input control logic
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-red-950 to-slate-950 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-red-400" />
        <p className="text-slate-300 font-semibold animate-pulse">Loading game...</p>
      </div>
    );
  }

  // Error state
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
        {/* Header */}
        <GameHeader
          playersCount={participants.length}
          status={lobby.status}
          selectedMode={lobby.selected_mode}
          askerUsername={askerUser?.profiles?.username}
          targetUsername={targetUser?.profiles?.username}
          onInvite={copyInviteLink}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row max-w-6xl mx-auto w-full">
          {/* Sidebar */}
          <PlayersSidebar
            participants={participants}
            messages={messages}
            currentTargetId={lobby.current_target_id}
            hostId={lobby.host_id}
          />

          {/* Chat Area */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {/* Waiting State */}
              {lobby.status === 'waiting' && (
                <WaitingRoom
                  isHost={isHost}
                  playersCount={participants.length}
                  onStartGame={handleStartGame}
                />
              )}

              {/* Mode Selection - Only show this component, nothing else */}
              {lobby.status === 'active' && !lobby.selected_mode && (
                <ModeSelector
                  isTarget={isTarget}
                  targetUsername={targetUser?.profiles?.username}
                  onSelectMode={handleSelectMode}
                />
              )}

              {/* Messages - Only show if mode is selected */}
              {lobby.status === 'active' && lobby.selected_mode && messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.user_id === profile?.id}
                />
              ))}

              {/* Next Round Button */}
              {lobby.status === 'active' && lobby.current_question && isHost && (
                <NextRoundButton onNextRound={handleNextRound} />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
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
  
