import { Check, Clock, Skull, Flame, AlertCircle } from 'lucide-react';
import { Message } from '@/hooks/useGameLogic'; // Ensure you import the interface

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => {
  const { message_type, content, image_url, profiles, created_at, status } = message;

  // SYSTEM MESSAGE
  if (message_type === 'system') {
    return (
      <div className="flex justify-center px-4 my-2">
        <div className="px-4 py-1.5 bg-slate-800/40 backdrop-blur-md rounded-full text-[11px] font-bold text-slate-400 border border-slate-700/30">
          {content}
        </div>
      </div>
    );
  }

  // TRUTH OR DARE CARD
  if (message_type === 'truth' || message_type === 'dare') {
    return (
      <div className="flex justify-center my-6 px-4">
        <div className={`max-w-lg w-full p-6 rounded-3xl border backdrop-blur-xl shadow-2xl relative overflow-hidden ${
            message_type === 'truth'
              ? 'bg-gradient-to-br from-orange-500/10 to-amber-500/5 border-orange-500/30'
              : 'bg-gradient-to-br from-red-600/10 to-rose-500/5 border-red-500/30'
          }`}>
          
          {/* Decorative Icon Watermark */}
          <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
             {message_type === 'truth' ? <Skull size={120} /> : <Flame size={120} />}
          </div>

          <div className="flex items-center gap-2 mb-3 relative z-10">
            {message_type === 'truth' ? (
              <Skull size={18} className="text-orange-400" />
            ) : (
              <Flame size={18} className="text-red-400" />
            )}
            <span className={`text-xs font-black tracking-wider uppercase ${
                message_type === 'truth' ? 'text-orange-400' : 'text-red-400'
              }`}>
              {message_type} Challenge
            </span>
          </div>

          <p className="text-lg sm:text-xl font-bold text-white/90 italic leading-relaxed relative z-10">
            &quot;{content}&quot;
          </p>

          {image_url && (
            <img src={image_url} alt="Challenge" className="mt-4 rounded-xl max-h-64 object-cover w-full shadow-lg border border-white/10 relative z-10" />
          )}
          
          <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-3">
             <p className="text-xs text-slate-400 font-medium">from <span className="text-slate-300">{profiles?.username}</span></p>
             <span className="text-[10px] text-slate-500">
                {new Date(created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </span>
          </div>
        </div>
      </div>
    );
  }

  // STANDARD CHAT MESSAGE
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end gap-2 px-2 group`}>
      <div className={`relative max-w-[85%] sm:max-w-xs px-4 py-2.5 shadow-md rounded-2xl transition-all ${
          isOwn
            ? 'bg-gradient-to-br from-red-500 to-orange-600 text-white rounded-tr-sm'
            : 'bg-slate-800/90 backdrop-blur-sm text-slate-100 border border-slate-700/50 rounded-tl-sm'
        }`}>
        
        {!isOwn && (
          <p className="text-[10px] font-bold text-orange-400/80 mb-1 ml-0.5">{profiles?.username}</p>
        )}

        {image_url && (
          <img src={image_url} alt="Shared" className="rounded-lg mb-2 max-h-48 object-cover w-full border border-black/10" />
        )}

        <p className="text-sm leading-relaxed">{content}</p>

        {/* Footer: Time & Status */}
        <div className="flex items-center justify-end gap-1.5 mt-1 select-none">
          <p className={`text-[10px] ${isOwn ? 'text-red-100/70' : 'text-slate-500'}`}>
            {new Date(created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          
          {isOwn && (
            <div className="flex items-center ml-0.5" title={status}>
              {status === 'sending' && (
                <Clock size={11} className="text-white/70 animate-pulse" />
              )}
              {status === 'sent' && (
                <Check size={12} className="text-white/90" strokeWidth={3} />
              )}
              {status === 'error' && (
                <AlertCircle size={12} className="text-red-900" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
