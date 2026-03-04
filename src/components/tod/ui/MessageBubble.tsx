// src/components/tod/ui/MessageBubble.tsx
import { User, CheckCheck, Clock, Image as ImageIcon, Reply, X, Skull, Flame, Sparkles, Mic } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Lightbox } from './Lightbox';

interface Message {
  id: string;
  content: string;
  image_url?: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system' | 'answer';
  created_at: string;
  status?: 'sending' | 'sent' | 'error';
  profiles?: { username: string };
  user_id: string;
  question_ref?: string;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  answerMessage?: Message;
  onMessageClick?: (messageId: string) => void;
  onReply?: (message: Message) => void;
  replyingTo?: Message | null;
}

const parseReply = (content: string) => {
  const replyRegex = /^@([^:]+): ([\s\S]*?)\n\n([\s\S]*)$/;
  const match = content.match(replyRegex);
  if (match) {
    return {
      username: match[1],
      replyContent: match[2],
      mainContent: match[3]
    };
  }
  return null;
};

const ReplyPreview = ({ username, content, isOwn }: { username: string, content: string, isOwn: boolean }) => (
  <div className={`mb-2 rounded-lg overflow-hidden flex border-l-4 ${isOwn ? 'border-red-400 bg-white/10' : 'border-red-500 bg-slate-900/40'
    } backdrop-blur-md`}>
    <div className="flex-1 p-2 py-1.5 min-w-0">
      <p className={`text-[10px] font-bold ${isOwn ? 'text-red-200' : 'text-red-400'} truncate`}>
        {username}
      </p>
      <p className="text-xs text-slate-200 truncate leading-tight">
        {content}
      </p>
    </div>
  </div>
);

export const MessageBubble = ({ message, isOwn, answerMessage, onMessageClick, onReply, replyingTo }: MessageBubbleProps) => {
  const [imageError, setImageError] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const messageRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 70; // pixels to trigger reply
  const MAX_SWIPE = 100; // maximum swipe distance

  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't allow swipe on system messages
    if (message.message_type === 'system') return;

    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;

    const touchCurrentX = e.touches[0].clientX;
    const touchCurrentY = e.touches[0].clientY;
    const deltaX = touchCurrentX - touchStartX.current;
    const deltaY = touchCurrentY - touchStartY.current;

    // Only allow horizontal swipe (not vertical scroll)
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      setIsSwiping(false);
      setSwipeDistance(0);
      return;
    }

    // Prevent vertical scrolling while swiping horizontally
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
    }

    // Swipe from right to left for own messages, left to right for others
    const swipeDirection = isOwn ? -deltaX : deltaX;

    if (swipeDirection > 0) {
      const clampedDistance = Math.min(swipeDirection, MAX_SWIPE);
      setSwipeDistance(clampedDistance);
    } else {
      setSwipeDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (swipeDistance > SWIPE_THRESHOLD && onReply) {
      onReply(message);
    }
    setSwipeDistance(0);
    setIsSwiping(false);
  };

  const swipeProgress = Math.min(swipeDistance / SWIPE_THRESHOLD, 1);
  const replyIconOpacity = swipeProgress;
  const replyIconScale = 0.5 + (swipeProgress * 0.5);

  // System messages
  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-full px-4 py-2 max-w-md">
          <p className="text-xs text-slate-300 text-center font-medium">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // Truth or Dare cards (questions)
  if (message.message_type === 'truth' || message.message_type === 'dare') {
    const modeColor = message.message_type === 'truth' ? 'blue' : 'orange';
    const modeGradient = message.message_type === 'truth'
      ? 'from-blue-500 to-cyan-500'
      : 'from-orange-500 to-red-500';
    const modeEmoji = message.message_type === 'truth' ? '😬' : '🔥';
    const modeSubtitle = message.message_type === 'truth'
      ? 'no cap, answer honestly 👀'
      : 'you better not skip 💀';

    return (
      <div
        id={`message-${message.id}`}
        className="flex flex-col gap-3 my-4 scroll-mt-20 relative"
        ref={messageRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${isOwn ? -swipeDistance : swipeDistance}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {/* Reply Icon */}
        {swipeDistance > 0 && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 ${isOwn ? 'left-4' : 'right-4'} z-10`}
            style={{
              opacity: replyIconOpacity,
              transform: `translateY(-50%) scale(${replyIconScale})`
            }}
          >
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
              <Reply size={20} className="text-slate-300" />
            </div>
          </div>
        )}

        {/* Question Card */}
        <div className={`max-w-lg ${isOwn ? 'ml-auto' : 'mr-auto'} w-full`}>
          <div className={`bg-gradient-to-br ${modeGradient} p-0.5 rounded-2xl shadow-lg`}>
            <div className="bg-slate-900 rounded-2xl p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${modeGradient} flex items-center justify-center text-lg`}>
                    {modeEmoji}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">
                      {isOwn ? 'You' : (message.profiles?.username || 'Anonymous')}
                    </p>
                    <p className={`text-xs font-black uppercase tracking-wider flex items-center gap-1 ${message.message_type === 'truth' ? 'text-blue-400' : 'text-orange-400'
                      }`}>
                      {message.message_type === 'truth' ? <Skull size={10} /> : <Flame size={10} />}
                      {message.message_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  {isOwn && message.status && (
                    <div className="flex items-center">
                      {message.status === 'sending' && (
                        <Clock size={10} className="text-slate-500" />
                      )}
                      {message.status === 'sent' && (
                        <CheckCheck size={10} className="text-green-500" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Question Content */}
              <div className="bg-slate-800/50 rounded-xl p-4 mb-1">
                <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${message.message_type === 'truth' ? 'text-blue-400/60' : 'text-orange-400/60'}`}>
                  {modeSubtitle}
                </p>
                {(() => {
                  const replyData = parseReply(message.content);
                  if (replyData) {
                    return (
                      <>
                        <ReplyPreview
                          username={replyData.username}
                          content={replyData.replyContent}
                          isOwn={isOwn}
                        />
                        <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {replyData.mainContent}
                        </p>
                      </>
                    );
                  }
                  return (
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  );
                })()}
                {message.image_url && !imageError && (
                  <div className="mt-3 rounded-lg overflow-hidden">
                    <img
                      src={message.image_url}
                      alt="Attached"
                      className="w-full max-h-64 object-cover cursor-pointer hover:brightness-110 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxUrl(message.image_url!);
                      }}
                      onError={() => setImageError(true)}
                    />
                  </div>
                )}
              </div>

              {/* Answer Section */}
              {answerMessage && (
                <div className={`bg-gradient-to-br ${message.message_type === 'truth' ? 'from-emerald-500/5 to-teal-500/5 border-emerald-500/20' : 'from-amber-500/5 to-orange-500/5 border-amber-500/20'} border rounded-xl p-4 mt-2`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Mic size={12} className="text-white" />
                    </div>
                    <p className="text-xs font-black text-green-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={10} />
                      {message.message_type === 'truth'
                        ? `${answerMessage.profiles?.username || 'Anonymous'} spilled the tea ☕`
                        : `${answerMessage.profiles?.username || 'Anonymous'} did it 💪`
                      }
                    </p>
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {answerMessage.content}
                  </p>
                  {answerMessage.image_url && (
                    <div className="mt-2 rounded-lg overflow-hidden">
                      <img
                        src={answerMessage.image_url}
                        alt="Answer"
                        className="w-full max-h-48 object-cover cursor-pointer hover:brightness-110 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxUrl(answerMessage.image_url!);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render standalone answer messages (they're shown inside question cards)
  if (message.message_type === 'answer') {
    return null;
  }

  // Regular chat messages
  return (
    <div
      id={`message-${message.id}`}
      className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} scroll-mt-20 relative`}
      ref={messageRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${isOwn ? -swipeDistance : swipeDistance}px)`,
        transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* Reply Icon */}
      {swipeDistance > 0 && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${isOwn ? 'left-2' : 'right-2'} z-10`}
          style={{
            opacity: replyIconOpacity,
            transform: `translateY(-50%) scale(${replyIconScale})`
          }}
        >
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
            <Reply size={16} className="text-slate-300" />
          </div>
        </div>
      )}

      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isOwn
        ? 'bg-gradient-to-br from-red-500 to-orange-500'
        : 'bg-slate-700'
        }`}>
        <User size={14} className="text-white" />
      </div>

      <div className={`max-w-xs sm:max-w-md flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <p className={`text-xs mb-1 ${isOwn ? 'text-slate-400' : 'text-slate-500'}`}>
          {isOwn ? 'You' : (message.profiles?.username || 'Anonymous')}
        </p>

        <div className={`rounded-2xl px-4 py-2 ${isOwn
          ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/10'
          : 'bg-slate-800 text-slate-100 border border-slate-700 shadow-lg shadow-black/20'
          }`}>
          {(() => {
            const replyData = parseReply(message.content);
            if (replyData) {
              return (
                <>
                  <ReplyPreview
                    username={replyData.username}
                    content={replyData.replyContent}
                    isOwn={isOwn}
                  />
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed brightness-110">
                    {replyData.mainContent}
                  </p>
                </>
              );
            }
            return (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {message.content}
              </p>
            );
          })()}

          {message.image_url && !imageError && (
            <div className="mt-2 rounded-lg overflow-hidden">
              <img
                src={message.image_url}
                alt="Attached"
                className="w-full max-h-48 object-cover cursor-pointer hover:brightness-110 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxUrl(message.image_url!);
                }}
                onError={() => setImageError(true)}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] text-slate-500">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          {isOwn && message.status && (
            <>
              {message.status === 'sending' && (
                <Clock size={10} className="text-slate-500" />
              )}
              {message.status === 'sent' && (
                <CheckCheck size={10} className="text-green-500" />
              )}
            </>
          )}
        </div>
      </div>

      <Lightbox
        src={lightboxUrl || ''}
        isOpen={!!lightboxUrl}
        onClose={() => setLightboxUrl(null)}
      />
    </div>
  );
};
