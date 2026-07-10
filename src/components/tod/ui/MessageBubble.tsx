// src/components/tod/ui/MessageBubble.tsx
import { CheckCheck, Clock, Reply, X, Skull, Flame, Sparkles, Mic, Dices, ChevronsRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Lightbox } from './Lightbox';
import VerifiedBadge from '@/components/VerifiedBadge';

interface Profile {
  username: string;
  avatar_url?: string;
  is_pro?: boolean;
}

interface Message {
  id: string;
  content: string;
  image_url?: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system' | 'answer';
  created_at: string;
  status?: 'sending' | 'sent' | 'error';
  profiles?: Profile;
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
  isActiveQuestion?: boolean;
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

// Small reusable avatar that falls back to initials, with an optional pro badge.
const Avatar = ({ profile, size = 32, ring }: { profile?: Profile; size?: number; ring?: string }) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    <div
      className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${ring || ''} ${!profile?.avatar_url ? 'bg-gradient-to-br from-slate-600 to-slate-700' : ''}`}
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={profile.username || 'User'} className="w-full h-full object-cover" />
      ) : (
        <span className="text-white font-bold text-xs uppercase">
          {(profile?.username || 'U').slice(0, 2)}
        </span>
      )}
    </div>
    {profile?.is_pro && (
      <span className="absolute -bottom-1 -right-1">
        <VerifiedBadge size={13} />
      </span>
    )}
  </div>
);

// Fires a short, distinct vibration pattern to physically notify the target
// that a new truth/dare card is waiting on them. Silently no-ops on devices
// or browsers without the Vibration API (e.g. iOS Safari, desktop).
const vibrateNotify = () => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([120, 60, 120, 60, 200]);
    } catch {
      // ignore — vibration is a nice-to-have, never block on it
    }
  }
};

export const MessageBubble = ({ message, isOwn, answerMessage, onMessageClick, onReply, replyingTo, isActiveQuestion }: MessageBubbleProps) => {
  const [imageError, setImageError] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const messageRef = useRef<HTMLDivElement>(null);
  const hasVibratedRef = useRef(false);

  const SWIPE_THRESHOLD = 70; // pixels to trigger reply
  const MAX_SWIPE = 100; // maximum swipe distance

  // Vibrate once, the moment this card becomes the active question the
  // current user needs to answer — a physical tap on the wrist/pocket that
  // says "your turn, swipe right to answer" alongside the visual cue.
  useEffect(() => {
    if (isActiveQuestion && !hasVibratedRef.current) {
      vibrateNotify();
      hasVibratedRef.current = true;
    }
    if (!isActiveQuestion) {
      hasVibratedRef.current = false;
    }
  }, [isActiveQuestion]);

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
      // Light haptic tick as the person crosses the trigger threshold,
      // confirming the swipe will register as a reply once released.
      if (clampedDistance >= SWIPE_THRESHOLD && swipeDistance < SWIPE_THRESHOLD) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(30); } catch {}
        }
      }
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
        <div className={`max-w-lg ${isOwn ? 'ml-auto' : 'mr-auto'} w-full relative`}>
          {isActiveQuestion && (
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-3xl blur opacity-30 animate-pulse" />
          )}
          <div
            className={`bg-gradient-to-br ${modeGradient} p-0.5 rounded-2xl shadow-lg relative ${isActiveQuestion ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-slate-950 animate-card-vibrate' : ''}`}
          >

            {/* Swipe-right guide for the target — the main gesture affordance */}
            {isActiveQuestion && (
              <div className="absolute inset-y-0 left-0 right-0 z-20 pointer-events-none flex items-center justify-between px-2">
                <div className="flex flex-col items-center animate-swipe-hint">
                  <ChevronsRight size={26} className="text-white drop-shadow-lg" />
                </div>
                <span className="text-[10px] font-black text-white uppercase tracking-wide whitespace-nowrap bg-red-500 px-2.5 py-1 rounded-full shadow-lg -translate-y-9">
                  Swipe right to answer
                </span>
              </div>
            )}

            <div className="bg-slate-900 rounded-2xl p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Avatar
                    profile={message.profiles}
                    size={32}
                    ring={`ring-2 ${message.message_type === 'truth' ? 'ring-blue-500/60' : 'ring-orange-500/60'}`}
                  />
                  <div>
                    <p className="text-white font-bold text-sm flex items-center gap-1">
                      {isOwn ? 'You' : (message.profiles?.username || 'Anonymous')}
                      {!isOwn && message.profiles?.is_pro && <VerifiedBadge size={12} />}
                    </p>
                    <p className={`text-xs font-black uppercase tracking-wider flex items-center gap-1 ${message.message_type === 'truth' ? 'text-blue-400' : 'text-orange-400'
                      }`}>
                      {message.message_type === 'truth' ? <Skull size={10} /> : <Flame size={10} />}
                      {message.message_type}
                      <Dices size={10} className="opacity-60" />
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
                    <Avatar profile={answerMessage.profiles} size={24} />
                    <p className="text-xs font-black text-green-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={10} />
                      {message.message_type === 'truth'
                        ? `${answerMessage.profiles?.username || 'Anonymous'} spilled the tea ☕`
                        : `${answerMessage.profiles?.username || 'Anonymous'} did it 💪`
                      }
                      {answerMessage.profiles?.is_pro && <VerifiedBadge size={11} />}
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

        <Lightbox
          src={lightboxUrl || ''}
          isOpen={!!lightboxUrl}
          onClose={() => setLightboxUrl(null)}
        />

        {/* Plain global <style> tag (not styled-jsx — styled-jsx has caused
            build/runtime issues elsewhere in this app) defining the two
            keyframe animations used above. Safe to duplicate across cards;
            the browser just dedupes identical rules. */}
        <style>{`
          @keyframes card-vibrate {
            0%, 100% { transform: translateX(0); }
            10% { transform: translateX(-2px) rotate(-0.3deg); }
            20% { transform: translateX(2px) rotate(0.3deg); }
            30% { transform: translateX(-2px) rotate(-0.3deg); }
            40% { transform: translateX(2px) rotate(0.3deg); }
            50% { transform: translateX(0); }
          }
          .animate-card-vibrate {
            animation: card-vibrate 3.5s ease-in-out infinite;
          }
          @keyframes swipe-hint {
            0%, 100% { transform: translateX(0); opacity: 0.6; }
            50% { transform: translateX(14px); opacity: 1; }
          }
          .animate-swipe-hint {
            animation: swipe-hint 1.1s ease-in-out infinite;
          }
        `}</style>
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

      <Avatar
        profile={message.profiles}
        size={32}
        ring={isOwn ? '' : ''}
      />

      <div className={`max-w-[75vw] sm:max-w-md flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <p className={`text-xs mb-1 flex items-center gap-1 ${isOwn ? 'text-slate-400 flex-row-reverse' : 'text-slate-500'}`}>
          {isOwn ? 'You' : (message.profiles?.username || 'Anonymous')}
          {message.profiles?.is_pro && <VerifiedBadge size={11} />}
        </p>

        <div className={`rounded-2xl px-4 py-2.5 ${isOwn
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
