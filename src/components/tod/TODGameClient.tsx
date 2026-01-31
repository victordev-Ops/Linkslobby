// src/components/tod/TODGameClient.tsx
"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2, AlertCircle, Users, UserPlus, Sparkles, Play, StopCircle, X, ArrowLeft, Timer, Clock, Trash2, LayoutGrid, ChevronLeft, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGameLogic } from "./hooks/useGameLogic";
import { PlayersSidebar } from "./ui/PlayersSidebar";
import { ModeSelector } from "./ui/ModeSelector";
import { MessageBubble } from "./ui/MessageBubble";
import { ChatInput } from "./ui/ChatInput";
import { WaitingRoom } from "./ui/WaitingRoom";
import { NextRoundButton } from "./ui/NextRoundButton";
import { GameStatus } from "./ui/GameStatus";
import { motion, AnimatePresence } from "framer-motion";

interface TODGameClientProps {
  lobbyId: string;
}

export default function TODGameClient({ lobbyId }: TODGameClientProps) {
  const { profile } = useAuth();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [replyingTo, setReplyingTo] = useState<typeof messages[0] | null>(null);
  const [hideFinishSummary, setHideFinishSummary] = useState(false);
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
    cleanup,
    approveRequest,
    declineRequest,
    banParticipant,
    unbanParticipant,
    loadMoreMessages,
    hasMoreMessages,
    leaveLobby,
    deleteLobby,
    onlineUsers,
    typingUsers,
    setTypingIndicator
  } = useGameLogic(lobbyId, profile?.id);

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const currentUserParticipant = participants.find(p => p.user_id === profile?.id);
  const isJoined = currentUserParticipant?.status === 'joined';
  const isRejected = currentUserParticipant?.status === 'rejected';
  const isBanned = currentUserParticipant?.status === 'banned';

  // Filter participants for UI - only show joined users in the list/counts
  const joinedParticipants = participants.filter(p => p.status === 'joined');
  const pendingRequests = participants.filter(p => p.status === 'pending');
  const bannedParticipants = participants.filter(p => p.status === 'banned');

  // Group messages with their answers - efficient O(n) with question_ref
  const messagesWithAnswers = useMemo(() => {
    return messages.map(msg => {
      if (msg.message_type === 'truth' || msg.message_type === 'dare') {
        // Find answer by question_ref foreign key - O(n) single pass
        const answer = messages.find(m =>
          m.message_type === 'answer' &&
          m.question_ref === msg.id
        );
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

  const targetUser = participants.find(p => p.user_id === lobby?.current_target_id);
  const askerUser = participants.find(p => p.user_id === lobby?.current_asker_id);
  const isTarget = profile?.id === lobby?.current_target_id;
  const isAsker = profile?.id === lobby?.current_asker_id;
  const isHost = profile?.id === lobby?.host_id;

  // Track status changes for notifications
  const prevStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentStatus = currentUserParticipant?.status;
    const prevStatus = prevStatusRef.current;

    // Only if we had a previous status (so we don't trigger on initial load if pending)
    if (prevStatus === 'pending') {
      if (currentStatus === 'joined') {
        toast.success("Request Approved! Welcome to the game! 🎉");
      } else if (currentStatus === 'rejected') {
        toast.error("Your join request was declined by the host.");
        router.push('/tod');
      } else if (currentStatus === undefined && !isLoading && !isHost) {
        // If we were pending and now we are gone (and not loading, and not host deleting ourselves)
        // This case might still happen if record is deleted, but now we use rejected status
        toast.error("You have been removed from the lobby.");
        router.push('/tod');
      }
    }

    prevStatusRef.current = currentStatus;
  }, [currentUserParticipant?.status, isLoading, isHost, router]);

  // Reset finish summary hidden state when game ends
  useEffect(() => {
    if (lobby?.status === 'finished') {
      setHideFinishSummary(false);
    }
  }, [lobby?.status]);

  // Handle banned status - redirect immediately
  useEffect(() => {
    if (isBanned && !isLoading) {
      toast.error('You have been banned from this lobby.');
      router.push('/tod');
    }
  }, [isBanned, isLoading, router]);

  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link copied! Share with friends 🎉");
  };

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    // Check if scrolled to top and there are more messages to load
    if (container.scrollTop === 0 && hasMoreMessages && !isLoadingMore && !isLoading) {
      const prevScrollHeight = container.scrollHeight;
      setIsLoadingMore(true);

      await loadMoreMessages();

      // Wait for DOM to update with new messages then restore scroll position
      setTimeout(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          // Calculate the difference and maintain position
          container.scrollTop = newScrollHeight - prevScrollHeight;
        }
        setIsLoadingMore(false);
      }, 50);
    }
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
        // Find the LATEST question message by content
        const questionMsg = [...messages].reverse().find(m =>
          (m.message_type === 'truth' || m.message_type === 'dare') &&
          m.content === lobby.current_question
        );

        // Check if there's already an answer for this question
        const hasAnswer = questionMsg && messages.some(m =>
          m.message_type === 'answer' &&
          m.question_ref === questionMsg.id
        );

        // Only mark as answer if not already answered
        if (!hasAnswer) {
          messageType = 'answer';
          questionRef = questionMsg?.id;
        }
      }
    }

    // Add reply context to message if replying
    let finalContent = content;
    if (replyingTo) {
      const replyUsername = replyingTo.profiles?.username || 'Someone';

      // If the message being replied to is already a reply, strip the grandparent context
      // This ensures we only show the immediate parent message in the reply preview
      let contentToPreview = replyingTo.content;
      if (contentToPreview.startsWith('@') && contentToPreview.includes('\n\n')) {
        contentToPreview = contentToPreview.split('\n\n').slice(1).join('\n\n');
      }

      const replyPreview = contentToPreview.length > 50
        ? contentToPreview.substring(0, 50) + '...'
        : contentToPreview;
      finalContent = `@${replyUsername}: ${replyPreview}\n\n${content}`;
    }

    await sendMessage(finalContent, imageUrl, messageType, profile?.username, questionRef);
    setReplyingTo(null); // Clear reply after sending
    setTimeout(() => scrollToBottom(true), 100);
  };

  const handleUploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    const url = await uploadImage(file);
    setIsUploading(false);
    return url;
  };

  const handleLeaveLobby = async () => {
    if (!lobby) {
      // Error state or not loaded
      router.push('/tod');
      return;
    }

    if (isHost) {
      if (confirm("Are you sure you want to DELETE this lobby? This will kick all players.")) {
        await deleteLobby();
        cleanup();
        router.push('/tod');
      }
    } else {
      // For participants: if pending, just cancel. If joined, confirm leave.
      if (isJoined) {
        if (confirm("Are you sure you want to leave the game?")) {
          await leaveLobby();
          cleanup();
          router.push('/tod');
        }
      } else {
        // Pending or Rejected - just leave/cancel request
        await leaveLobby();
        cleanup();
        router.push('/tod');
      }
    }
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

  const handleReply = (message: typeof messages[0]) => {
    setReplyingTo(message);
    // Focus on input (implement in ChatInput)
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };



  const canSendMessage = () => {
    if (!isJoined) return false;

    // Host can always chat if they are joined
    if (isHost) return true;

    // Allow chat in waiting and finished states for everyone
    if (lobby?.status === 'waiting') return true;
    if (lobby?.status === 'finished') return true;

    // During active game
    if (lobby?.status === 'active') {
      // Asker can ask question after mode is selected
      if (lobby?.selected_mode && !lobby?.current_question && isAsker) return true;
      // Target can answer question
      if (lobby?.current_question && isTarget) return true;

      // After target answers, everyone can chat until next round
      if (lobby?.current_question) {
        const hasAnswer = messages.some(m =>
          m.message_type === 'answer' &&
          m.question_ref && // Message is an answer
          messages.some(q => q.id === m.question_ref && q.content === lobby.current_question)
        );
        if (hasAnswer) return true; // Everyone can chat after answer
      }

      // Otherwise spectators cannot chat
      return false;
    }

    return false;
  };

  const getInputPlaceholder = () => {
    if (lobby?.status === 'waiting') return "Chat with everyone...";
    if (lobby?.status === 'finished') return "Chat with everyone...";
    if (lobby?.status === 'active') {
      if (!lobby?.selected_mode && isTarget) return "Select truth or dare above...";
      if (!lobby?.selected_mode && !isTarget) return "Waiting for mode selection...";
      if (lobby?.selected_mode && !lobby?.current_question && isAsker) {
        return `Ask a ${lobby.selected_mode} question...`;
      }
      if (lobby?.selected_mode && !lobby?.current_question && !isAsker) {
        return "Waiting for question...";
      }
      if (lobby?.current_question && isTarget) {
        // Check if target already answered the LATEST question
        const currentQuestionMsg = [...messages].reverse().find(m =>
          (m.message_type === 'truth' || m.message_type === 'dare') &&
          m.content === lobby.current_question
        );
        const hasAnswer = currentQuestionMsg && messages.some(m =>
          m.message_type === 'answer' &&
          m.question_ref === currentQuestionMsg.id
        );
        if (hasAnswer) return "Chat with everyone...";
        return "Type your answer...";
      }
      if (lobby?.current_question && !isTarget) {
        // Check if answer has been given for the LATEST question
        const currentQuestionMsg = [...messages].reverse().find(m =>
          (m.message_type === 'truth' || m.message_type === 'dare') &&
          m.content === lobby.current_question
        );
        const hasAnswer = currentQuestionMsg && messages.some(m =>
          m.message_type === 'answer' &&
          m.question_ref === currentQuestionMsg.id
        );
        if (hasAnswer) return "Chat with everyone...";
        return "Waiting for answer...";
      }
      // Default for spectators
      return "Spectating - chat disabled during game...";
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



  return (
    <div className="flex h-[100dvh] bg-slate-950 overflow-hidden relative font-sans selection:bg-red-500/30 overscroll-behavior-none">
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-500 rounded-full blur-[120px]" />
      </div>

      {
        isRejected && !isLoading && (
          <div className="relative z-50 min-h-screen flex flex-col items-center justify-center p-6 text-center backdrop-blur-md bg-slate-950/40">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-500/50">
              <X size={32} className="text-red-400" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4 italic">Request Rejected</h2>
            <p className="text-slate-400 max-w-md leading-relaxed mb-8">
              Your request to join this lobby was declined by the host.
            </p>
            <button
              onClick={handleLeaveLobby}
              className="px-8 py-3 rounded-full bg-slate-800 border border-slate-700 text-white font-bold hover:bg-slate-700 transition active:scale-95"
            >
              Go Back
            </button>
          </div>
        )
      }

      {
        isBanned && !isLoading && (
          <div className="relative z-50 min-h-screen flex flex-col items-center justify-center p-6 text-center backdrop-blur-md bg-slate-950/40">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-500/50">
              <X size={32} className="text-red-400" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4 italic">Banned from Lobby</h2>
            <p className="text-slate-400 max-w-md leading-relaxed mb-8">
              You have been permanently banned from this lobby by the host.
            </p>
            <button
              onClick={handleLeaveLobby}
              className="px-8 py-3 rounded-full bg-slate-800 border border-slate-700 text-white font-bold hover:bg-slate-700 transition active:scale-95"
            >
              Go Back
            </button>
          </div>
        )
      }

      {
        !isJoined && !isRejected && !isBanned && !isLoading && (
          <div className="relative z-50 min-h-screen flex flex-col items-center justify-center p-6 text-center backdrop-blur-md bg-slate-950/40">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse border border-amber-500/50">
              <Clock size={32} className="text-amber-400" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4 italic">Waiting for Approval</h2>
            <p className="text-slate-400 max-w-md leading-relaxed mb-8">
              This is a private lobby. Your request to join has been sent to the host.
              Please wait while they review your request.
            </p>
            <button
              onClick={handleLeaveLobby}
              className="px-8 py-3 rounded-full bg-slate-800 border border-slate-700 text-white font-bold hover:bg-slate-700 transition active:scale-95"
            >
              Go Back
            </button>
          </div>
        )
      }

      {/* Main Container */}
      <div className="relative z-10 h-full flex flex-col overflow-hidden">
        {/* Top Header - STICKY */}
        <header className="sticky top-0 z-[100] flex-shrink-0 px-4 py-3 backdrop-blur-xl bg-slate-900/80 border-b border-white/5 shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/tod')}
                  className="flex w-9 h-9 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white items-center justify-center transition active:scale-95"
                  title="Back to Lobbies"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  onClick={handleLeaveLobby}
                  className={`flex w-9 h-9 rounded-full border items-center justify-center transition active:scale-95 ${isHost
                    ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-400'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white'}`}
                  title={isHost ? "Delete Lobby" : "Leave Lobby"}
                >
                  {isHost ? <Trash2 size={16} /> : <LogOut size={16} />}
                </button>
              </div>

              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg relative"
              >
                <Users size={16} className="text-white" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white border-2 border-slate-900">
                  {joinedParticipants.length}
                </span>
              </button>

              <div className="hidden lg:flex items-center gap-2 text-sm">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <Users size={16} className="text-white" />
                </div>
                <span className="text-white font-bold">{joinedParticipants.length} Players</span>
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
                <div className={`px-3 py-1 rounded-full border flex items-center gap-1.5 ${timeRemaining <= 10
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
              {isHost && lobby.status === 'finished' && messages.length > 3 && (
                <button
                  onClick={handleStartGame}
                  className="px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Play size={14} />
                  <span className="hidden sm:inline">Play Again</span>
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
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
                  <h2 className="text-lg font-bold text-white">Game Info</h2>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition"
                  >
                    <X size={16} className="text-white" />
                  </button>
                </div>
                <PlayersSidebar
                  participants={joinedParticipants}
                  messages={messages}
                  currentTargetId={lobby.current_target_id}
                  hostId={lobby.host_id}
                  onActivityClick={handleActivityClick}
                  pendingRequests={pendingRequests}
                  bannedParticipants={bannedParticipants}
                  onApproveRequest={approveRequest}
                  onDeclineRequest={declineRequest}
                  onBanParticipant={banParticipant}
                  onUnbanParticipant={unbanParticipant}
                  isHost={isHost}
                  onlineUsers={onlineUsers}
                  currentAskerId={lobby.current_asker_id}
                  lobbyName={lobby.name}
                />
              </div>
            </div>
          )}

          {/* Desktop Sidebar */}
          <PlayersSidebar
            participants={joinedParticipants}
            messages={messages}
            currentTargetId={lobby.current_target_id}
            hostId={lobby.host_id}
            className="hidden lg:flex"
            onActivityClick={handleActivityClick}
            pendingRequests={pendingRequests}
            bannedParticipants={bannedParticipants}
            onApproveRequest={approveRequest}
            onDeclineRequest={declineRequest}
            onBanParticipant={banParticipant}
            onUnbanParticipant={unbanParticipant}
            isHost={isHost}
            onlineUsers={onlineUsers}
            currentAskerId={lobby.current_asker_id}
            lobbyName={lobby.name}
          />

          {/* Chat Area */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            >
              {hasMoreMessages && (
                <div className="flex justify-center py-2">
                  <div className="bg-slate-800/40 px-3 py-1 rounded-full text-[10px] text-slate-500 font-bold flex items-center gap-2">
                    {isLoadingMore ? <Loader2 size={10} className="animate-spin" /> : <Clock size={10} />}
                    {isLoadingMore ? "Loading history..." : "Scroll up for more"}
                  </div>
                </div>
              )}


              {lobby.status === 'waiting' && (
                <WaitingRoom
                  isHost={isHost}
                  playersCount={joinedParticipants.length}
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
                  onReply={handleReply}
                  replyingTo={replyingTo}
                />
              ))}

              {/* Next Round Button - efficiently checks for answer via question_ref */}
              {lobby.status === 'active' && lobby.current_question && isHost && (
                (() => {
                  // Find the LATEST question message by content
                  const currentQuestionMsg = [...messages].reverse().find(m =>
                    (m.message_type === 'truth' || m.message_type === 'dare') &&
                    m.content === lobby.current_question
                  );

                  if (!currentQuestionMsg) return null;

                  // Check if there's an answer with matching question_ref - O(n) single pass
                  const hasAnswer = messages.some(m =>
                    m.message_type === 'answer' &&
                    m.question_ref === currentQuestionMsg.id
                  );

                  return hasAnswer ? <NextRoundButton onNextRound={handleNextRound} /> : null;
                })()
              )}

              {lobby.status === 'finished' && !hideFinishSummary && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                    <Sparkles size={32} className="text-red-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Game Ended!</h3>
                  <p className="text-slate-400 text-sm mb-6">Thanks for playing!</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    {isHost && messages.length <= 3 && (
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

            {/* Mode Selector - Shows when target needs to select - STICKY */}
            {lobby.status === 'active' && !lobby.selected_mode && isTarget && (
              <div className="sticky bottom-0 z-20 flex-shrink-0 px-4 py-4 border-t border-slate-800/50 backdrop-blur-xl bg-slate-900/50">
                <ModeSelector
                  isTarget={isTarget}
                  targetUsername={targetUser?.profiles?.username}
                  onSelectMode={handleSelectMode}
                  timeRemaining={timeRemaining}
                />
              </div>
            )}

            {/* Chat Input - STICKY AT BOTTOM */}
            <div className="sticky bottom-0 z-10 flex-shrink-0">
              {/* Typing Indicator */}
              <AnimatePresence>
                {Object.keys(typingUsers).length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-4 mb-2 flex items-center gap-2"
                  >
                    <div className="flex gap-1 px-3 py-2 bg-slate-800/80 backdrop-blur-md rounded-2xl rounded-bl-none border border-slate-700/50 shadow-lg">
                      <div className="flex gap-1 items-center h-4">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{
                              y: [0, -4, 0],
                            }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              delay: i * 0.15,
                              ease: "easeInOut",
                            }}
                            className="w-1.5 h-1.5 bg-red-400 rounded-full"
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-slate-300 ml-1">
                        {Object.values(typingUsers).length === 1
                          ? `${Object.values(typingUsers)[0].username} is typing...`
                          : Object.values(typingUsers).length === 2
                            ? `${Object.values(typingUsers)[0].username} and ${Object.values(typingUsers)[1].username} are typing...`
                            : "Several people are typing..."}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <ChatInput
                canSend={canSendMessage()}
                placeholder={getInputPlaceholder()}
                isUploading={isUploading}
                onSend={handleSendMessage}
                onUploadImage={handleUploadImage}
                replyingTo={replyingTo}
                onCancelReply={handleCancelReply}
                onInteraction={() => setHideFinishSummary(true)}
                onTyping={setTypingIndicator}
              />
            </div>
          </main>
        </div>
      </div>
    </div >
  );
}
