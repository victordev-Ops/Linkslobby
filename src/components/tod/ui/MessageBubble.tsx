import { Check, Clock, Skull, Flame } from 'lucide-react';

interface Message {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system';
  created_at: string;
  profiles?: { username: string };
  isOptimistic?: boolean;
  isSent?: boolean;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => {
  const { message_type, content, image_url, profiles, created_at, isOptimistic, isSent } = message;

  if (message_type === 'system') {
    return (
      <div className="flex justify-center px-4">
        <div className="px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-full text-xs font-bold text-slate-300 border border-slate-700/50 max-w-[90%] text-center">
          {content}
        </div>
      </div>
    );
  }

  if (message_type === 'truth' || message_type === 'dare') {
    return (
      <div className="flex justify-center my-6 px-4">
        <div
          className={`max-w-lg w-full p-5 sm:p-6 rounded-3xl border-2 backdrop-blur-md ${
            message_type === 'truth'
              ? 'bg-orange-500/10 border-orange-500/50'
              : 'bg-red-500/10 border-red-500/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            {message_type === 'truth' ? (
              <Skull size={20} className="text-orange-400 flex-shrink-0" />
            ) : (
              <Flame size={20} className="text-red-400 flex-shrink-0" />
            )}
            <span
              className={`text-xs font-black uppercase ${
                message_type === 'truth' ? 'text-orange-400' : 'text-red-400'
              }`}
            >
              {message_type} Challenge
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white italic leading-relaxed">
            &quot;{content}&quot;
          </p>
          {image_url && (
            <img
              src={image_url}
              alt="Challenge"
              className="mt-4 rounded-2xl max-h-64 object-cover w-full"
            />
          )}
          <p className="text-xs text-slate-400 mt-3">from {profiles?.username}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end gap-2 px-2`}>
      <div
        className={`max-w-[85%] sm:max-w-xs ${
          isOwn
            ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white'
            : 'bg-slate-800/80 backdrop-blur-sm text-white border border-slate-700/50'
        } rounded-2xl px-4 py-3 shadow-lg`}
      >
        {!isOwn && (
          <p className="text-xs font-bold opacity-70 mb-1">{profiles?.username}</p>
        )}
        {image_url && (
          <img
            src={image_url}
            alt="Shared"
            className="rounded-xl mb-2 max-h-48 object-cover w-full"
          />
        )}
        <p className="text-sm break-words leading-relaxed">{content}</p>
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <p className="text-xs opacity-60">
            {new Date(created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          {isOwn && (
            <div className="flex items-center">
              {isOptimistic && !isSent ? (
                <Clock size={12} className="opacity-50" />
              ) : (
                <Check size={12} className="opacity-70" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
