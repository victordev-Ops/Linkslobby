import { useState, useRef, useEffect } from 'react';
import { Send, ImageIcon, X, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface ChatInputProps {
  canSend: boolean;
  placeholder: string;
  isUploading: boolean;
  onSend: (content: string, imageUrl: string | null) => Promise<void>;
  onUploadImage: (file: File) => Promise<string | null>;
}

export const ChatInput = ({
  canSend,
  placeholder,
  isUploading,
  onSend,
  onUploadImage
}: ChatInputProps) => {
  const [messageInput, setMessageInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [messageInput]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!messageInput.trim() && !selectedImage) return;

    let imageUrl = null;
    if (selectedImage) {
      imageUrl = await onUploadImage(selectedImage);
      if (!imageUrl) return;
    }

    await onSend(messageInput.trim(), imageUrl);
    setMessageInput('');
    removeImage();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-shrink-0 p-3 sm:p-4 backdrop-blur-xl bg-slate-900/80 border-t border-slate-800/50">
      {/* Image Preview */}
      {imagePreview && (
        <div className="mb-3 relative inline-block">
          <img
            src={imagePreview}
            alt="Preview"
            className="h-20 rounded-xl object-cover border-2 border-red-500/50"
          />
          <button
            onClick={removeImage}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition active:scale-90"
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
            {placeholder}
          </p>
        </div>
      )}

      {/* Input Controls */}
      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
          disabled={!canSend}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!canSend}
          className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition shrink-0 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
        >
          <ImageIcon size={20} className="text-slate-300" />
        </button>

        <textarea
          ref={textareaRef}
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={!canSend}
          className="flex-1 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-red-500 transition resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          rows={1}
          style={{ maxHeight: '120px' }}
        />

        <button
          onClick={handleSend}
          disabled={(!messageInput.trim() && !selectedImage) || isUploading || !canSend}
          className="p-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white hover:shadow-lg hover:shadow-red-500/50 transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0 active:scale-90"
        >
          {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );
};
  
