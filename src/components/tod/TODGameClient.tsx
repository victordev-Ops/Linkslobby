// src/components/tod/TODGameClient.tsx
"use client";

import { useRef, useEffect, useState, useMemo } from "react";
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

  // Group messages with their answers
  const messagesWithAnswers = useMemo(() => {
    return messages.map(msg => {
      if (msg.message_type === 'truth' || msg.message_type === 'dare') {
        const answer = messages.find(m => m.message_type === 'answer' && m.question_ref === msg.id);
        return { ...msg, answerMessage: answer } as typeof msg & { answerMessage?: typeof msg };
      }
      return msg as typeof msg & { answerMessage?: typeof msg };
    });
  }, [messages]);

  // Smart scroll: only auto-scroll if user is near bottom
  const scrollToBottom = (force = false) => {
    if (!messagesContainerRef.current || !messagesEndRef.current) return;

    const container = messagesContainerRef.current;
    const scrollThreshold = 150;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < scrollThreshold;

    if (force || isNearBottom) {
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
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link copied! Share with friends 🎉");
  };

  const handleSelectMode = async (mode: 'truth' | 'dare') => {
    await selectMode(mode);
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
    const isTarget = profile?.id === lobby?.current_target_id;
    
    let messageType: 'chat' | 'truth' | 'dare' | 'system' | 'answer' = 'chat';
    let questionRef: string | undefined;

    // Determine message type based on game state
    if (lobby?.status === 'active') {
      // If asker is asking the question
      if (isAsker && lobby?.selected_mode && !lobby?.current_question) {
        messageType = lobby.selected_mode;
      }
      // If target is answering the question
      else if (isTarget && lobby?.current_question) {
        messageType = 'answer';
        // Find the question message ID
        const questionMsg = messages.find(m => 
          (m.message_type === 'truth' || m.message_type === 'dare') && 
          m.content === lobby.current_question
        );
        questionRef = questionMsg?.id;
      }
    }

    await sendMessage(content, imageUrl, messageType, profile?.username, questionRef);
    setTimeout(() => scrollToBottom(true), 100);
  };

  const handleUploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    const url = await uploadImage(file);
    setIsUploading(false);
    return url;
  };

  const handleLeaveLobby = () => {
    cleanup();
    router.push('/tod');
  };

  const handleActivityClick = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-red-500', 'ring-offset-2', 'ring-offset-slate-950');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2', 'ring-offset-slate-950');
      }, 2000);
    }
    // Close sidebar on mobile after clicking
    if (showSidebar) {
      setShowSidebar(false);
    }
  };

  const isTarget = profile?.id === lobby?.current_target_id;
  const isAsker = profile?.id === lobby?.current_asker_id;
  const isHost = profile?.id === lobby?.host_id;

  const canSendMessage = () => {
    if (lobby?.status === 'waiting') return true;
    if (lobby?.status === 'finished') return true;
    
    if (lobby?.status === 'active') {
      // Target can select mode
      if (!lobby?.selected_mode && isTarget) return false; // They use mode selector
      // Asker can ask question after mode is selected
      if (lobby?.selected_mode && !lobby?.current_question) return isAsker;
      // Target can answer question
      if (lobby?.current_question) return isTarget;
    }
    
    return false;
  };

  const getInputPlaceholder = () => {
    if (lobby?.status === 'waiting') return "Chat with everyone...";
    if (lobby?.status === 'finished') return "Chat with everyone...";
    if (!lobby?.selected_mode && isTarget) return "Select truth or dare above...";
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
          onClick={handleLeaveLobby}
          className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-red-500/50 transition flex items-center gap-2"
        >
          <ArrowLeft size={20} />
          Back to Lobbies
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
            <div className="flex items-center gap-2">
              <button
                onClick={handleLeaveLobby}
                className="hidden lg:flex w-9 h-9 rounded-full bg-slate-800 border border-slate-700 items-center justify-center hover:bg-slate-700 transition"
              >
                <ArrowLeft size={16} className="text-white" />
              </button>

              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg relative"
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
            </div>

            <div className="flex items-center gap-2">
              <GameStatus
                status={lobby.status}
                selectedMode={lobby.selected_mode}
                askerUsername={askerUser?.profiles?.username}
                targetUsername={targetUser?.profiles?.username}
              />
              
              {/* Timer only shows when target needs to select mode */}
              {lobby.status === 'active' && !lobby.selected_mode && timeRemaining !== null && (
                <div className={`px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                  timeRemaining <= 10 
                    ? 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse' 
                    : 'bg-slate-800/80 border-slate-700/50 text-slate-300'
                }`}>
                  <Timer size={12} />
                  <span className="text-xs font-bold">{timeRemaining}s</span>
                </div>
              )}
            </div>

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
                className="absolute left-0 top-0 bottom-0 w-80 bg-slate-900 shadow-2xl overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                  <h2 className="text-lg font-bold text-white">Game Info</h2>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition"
                  >
                    <X size={16} className="text-white" />
                  </button>
                </div>
                <PlayersSidebar
                  participants={participants}
                  messages={messages}
                  currentTargetId={lobby.current_target_id}
                  hostId={lobby.host_id}
                  onActivityClick={handleActivityClick}
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
            className="hidden lg:flex"
            onActivityClick={handleActivityClick}
          />

          {/* Chat Area */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            >
              {lobby.status === 'waiting' && (
                <WaitingRoom
                  isHost={isHost}
                  playersCount={participants.length}
                  onStartGame={handleStartGame}
                />
              )}

              {/* Messages */}
              {messagesWithAnswers.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.user_id === profile?.id}
                  answerMessage={msg.answerMessage}
                />
              ))}

              {/* Next Round Button - only shows after answer is given */}
              {lobby.status === 'active' && lobby.current_question && isHost && 
               messages.some(m => m.message_type === 'answer' && m.question_ref === messages.find(q => q.content === lobby.current_question)?.id) && (
                <NextRoundButton onNextRound={handleNextRound} />
              )}

              {lobby.status === 'finished' && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                    <Sparkles size={32} className="text-red-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Game Ended!</h3>
                  <p className="text-slate-400 text-sm mb-6">Thanks for playing!</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    {isHost && (
                      <button
                        onClick={handleStartGame}
                        className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 inline-flex items-center gap-2"
                      >
                        <Play size={20} />
                        Play Again
                      </button>
                    )}
                    <button
                      onClick={handleLeaveLobby}
                      className="bg-slate-800 border border-slate-700 text-white px-8 py-3 rounded-full font-bold hover:bg-slate-700 transition-all active:scale-95 inline-flex items-center gap-2"
                    >
                      <ArrowLeft size={20} />
                      Back to Lobbies
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Mode Selector - Shows when target needs to select */}
            {lobby.status === 'active' && !lobby.selected_mode && isTarget && (
              <div className="flex-shrink-0 px-4 py-4 border-t border-slate-800/50 backdrop-blur-xl bg-slate-900/50">
                <ModeSelector
                  isTarget={isTarget}
                  targetUsername={targetUser?.profiles?.username}
                  onSelectMode={handleSelectMode}
                  timeRemaining={timeRemaining}
                />
              </div>
            )}

            {/* Chat Input - STICKY AT BOTTOM */}
            <div className="flex-shrink-0">
              <ChatInput
                canSend={canSendMessage()}
                placeholder={getInputPlaceholder()}
                isUploading={isUploading}
                onSend={handleSendMessage}
                onUploadImage={handleUploadImage}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
