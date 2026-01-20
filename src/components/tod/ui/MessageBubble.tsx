// src/components/tod/ui/MessageBubble.tsx
import { User, CheckCheck, Clock, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';

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
  answerMessage?: Message; // The answer to this question, if any
  onMessageClick?: (messageId: string) => void;
}

export const MessageBubble = ({ message, isOwn, answerMessage, onMessageClick }: MessageBubbleProps) => {
  const [imageError, setImageError] = useState(false);

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

    return (
      <div 
        id={`message-${message.id}`}
        className="flex flex-col gap-3 my-4 scroll-mt-20"
      >
        {/* Question Card */}
        <div className={`max-w-lg ${isOwn ? 'ml-auto' : 'mr-auto'} w-full`}>
          <div className={`bg-gradient-to-br ${modeGradient} p-0.5 rounded-2xl shadow-lg`}>
            <div className="bg-slate-900 rounded-2xl p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${modeGradient} flex items-center justify-center`}>
                    <User size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">
                      {isOwn ? 'You' : (message.profiles?.username || 'Anonymous')}
                    </p>
                    <p className={`text-xs font-bold uppercase ${
                      message.message_type === 'truth' ? 'text-blue-400' : 'text-orange-400'
                    }`}>
                      {message.message_type}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {/* Question Content */}
              <div className="bg-slate-800/50 rounded-xl p-4 mb-3">
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                {message.image_url && !imageError && (
                  <div className="mt-3 rounded-lg overflow-hidden">
                    <img
                      src={message.image_url}
                      alt="Attached"
                      className="w-full max-h-64 object-cover"
                      onError={() => setImageError(true)}
                    />
                  </div>
                )}
              </div>

              {/* Answer Section */}
              {answerMessage && (
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <CheckCheck size={12} className="text-white" />
                    </div>
                    <p className="text-xs font-bold text-green-400 uppercase">
                      Answer from {answerMessage.profiles?.username || 'Anonymous'}
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
                        className="w-full max-h-48 object-cover"
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
      className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} scroll-mt-20`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isOwn 
          ? 'bg-gradient-to-br from-red-500 to-orange-500' 
          : 'bg-slate-700'
      }`}>
        <User size={14} className="text-white" />
      </div>

      <div className={`max-w-xs sm:max-w-md flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <p className={`text-xs mb-1 ${isOwn ? 'text-slate-400' : 'text-slate-500'}`}>
          {isOwn ? 'You' : (message.profiles?.username || 'Anonymous')}
        </p>
        
        <div className={`rounded-2xl px-4 py-2 ${
          isOwn 
            ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white' 
            : 'bg-slate-800 text-slate-100 border border-slate-700'
        }`}>
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
          
          {message.image_url && !imageError && (
            <div className="mt-2 rounded-lg overflow-hidden">
              <img
                src={message.image_url}
                alt="Attached"
                className="w-full max-h-48 object-cover"
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
    </div>
  );
};
          
