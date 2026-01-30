// src/components/tod/ui/ChatInput.tsx
import { useState, useRef, useEffect } from 'react';
import { Send, ImageIcon as ImageIconLucide, X, Loader2, Clock, Reply } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  profiles?: { username: string };
  message_type: string;
}

interface ChatInputProps {
  canSend: boolean;
  placeholder: string;
  isUploading: boolean;
  onSend: (content: string, imageUrl: string | null) => Promise<void>;
  onUploadImage: (file: File) => Promise<string | null>;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  onInteraction?: () => void;
  onTyping?: (isTyping: boolean) => void;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXTAREA_HEIGHT = 120; // pixels

export const ChatInput = ({
  canSend,
  placeholder,
  isUploading,
  onSend,
  onUploadImage,
  replyingTo,
  onCancelReply,
  onInteraction,
  onTyping
}: ChatInputProps) => {
  const [messageInput, setMessageInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [messageInput]);

  // Focus on textarea when replying
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  // Handle typing indicator
  useEffect(() => {
    if (messageInput.length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping?.(true);
      }

      // Reset timer
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTyping?.(false);
      }, 3000);
    } else if (isTypingRef.current) {
      isTypingRef.current = false;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      onTyping?.(false);
    }
  }, [messageInput, onTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    onInteraction?.();
  };

  const removeImage = () => {
    // Revoke object URL to free memory
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(null);
    setImagePreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetInput = () => {
    setMessageInput('');
    removeImage();
    setIsSending(false);
  };

  const handleSend = async () => {
    // Validation
    if (!messageInput.trim() && !selectedImage) return;
    if (!canSend || isSending) return;

    setIsSending(true);

    try {
      let imageUrl: string | null = null;

      // Upload image if present
      if (selectedImage) {
        imageUrl = await onUploadImage(selectedImage);
        if (!imageUrl) {
          toast.error('Failed to upload image');
          setIsSending(false);
          return;
        }
      }

      // Send message
      await onSend(messageInput.trim(), imageUrl);

      // Reset input after successful send
      resetInput();

      // Immediately stop typing indicator
      if (isTypingRef.current) {
        isTypingRef.current = false;
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        onTyping?.(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = !canSend || isSending || isUploading;
  const canSubmit = (messageInput.trim() || selectedImage) && !isDisabled;

  const getReplyPreview = () => {
    if (!replyingTo) return '';
    const preview = replyingTo.content.length > 50
      ? replyingTo.content.substring(0, 50) + '...'
      : replyingTo.content;
    return preview;
  };

  return (
    <div className="flex-shrink-0 backdrop-blur-xl bg-slate-900/80 border-t border-slate-800/50">
      {/* Reply Preview */}
      {replyingTo && (
        <div className="px-4 pt-3 pb-2 border-b border-slate-800/50">
          <div className="flex items-start gap-2 bg-slate-800/50 rounded-lg p-3">
            <Reply size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-300 mb-1">
                Replying to {replyingTo.profiles?.username || 'Someone'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {getReplyPreview()}
              </p>
            </div>
            <button
              onClick={onCancelReply}
              className="p-1 rounded-full hover:bg-slate-700 transition flex-shrink-0"
              aria-label="Cancel reply"
            >
              <X size={14} className="text-slate-400" />
            </button>
          </div>
        </div>
      )}

      <div className="p-3 sm:p-4">
        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-20 w-20 rounded-xl object-cover border-2 border-red-500/50"
            />
            <button
              type="button"
              onClick={removeImage}
              disabled={isSending}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition active:scale-90 disabled:opacity-50"
              aria-label="Remove image"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Disabled State Message */}
        {!canSend && (
          <div className="mb-2 text-center">
            <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
              <Clock size={12} />
              <span>{placeholder}</span>
            </p>
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
            disabled={isDisabled}
            aria-label="Upload image"
          />

          {/* Image Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition shrink-0 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
            aria-label="Select image"
          >
            <ImageIconLucide size={20} className="text-slate-300" />
          </button>

          {/* Message Textarea */}
          <textarea
            ref={textareaRef}
            value={messageInput}
            onChange={(e) => {
              setMessageInput(e.target.value);
              onInteraction?.();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isDisabled}
            className="flex-1 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-red-500 transition resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
            style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
            aria-label="Message input"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSubmit}
            className="p-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white hover:shadow-lg hover:shadow-red-500/50 transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0 active:scale-90"
            aria-label="Send message"
          >
            {isSending || isUploading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

