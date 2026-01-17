"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { 
  Users, Sparkles, Send, ArrowRight, 
  Skull, Flame, Loader2, AlertCircle,
  Copy, Crown, CheckCircle2, UserPlus, Image as ImageIcon,
  X, Check, Clock
} from "lucide-react";

interface Message {
  id: string;
  lobby_id: string;
  user_id: string;
  content: string;
  image_url?: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system';
  created_at: string;
  profiles?: { username: string };
  isOptimistic?: boolean;
  isSent?: boolean;
}

interface OptimisticMessage extends Message {
  tempId: string;
}

export default function TODGameClient({ lobbyId }: { lobbyId: string }) {
  const { profile } = useAuth();
  const [supabase] = useState(() => createClient());
  
  const [lobby, setLobby] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const isMounted = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [messageInput]);

  // --- Data Fetching ---
  const fetchParticipants = useCallback(async () => {
    if (!lobbyId || lobbyId === "undefined") return;
    const { data, error } = await supabase
      .from("tod_participants")
      .select("user_id, has_gone_this_round, profiles(username)")
      .eq("lobby_id", lobbyId);
    if (!error && isMounted.current) setParticipants(data || []);
  }, [lobbyId, supabase]);

  const fetchMessages = useCallback(async () => {
    if (!lobbyId || lobbyId === "undefined") return;
    const { data, error } = await supabase
      .from("tod_messages")
      .select("*, profiles(username)")
      .eq("lobby_id", lobbyId)
      .order("created_at", { ascending: true });
    if (!error && isMounted.current) {
      // Merge with optimistic messages, marking real messages as sent
      setMessages(prev => {
        const optimisticMsgs = prev.filter(m => m.isOptimistic);
        const realMessages = (data || []).map(msg => ({ ...msg, isSent: true }));
        
        // Remove optimistic messages that now exist in real messages
        const filteredOptimistic = optimisticMsgs.filter(opt => 
          !realMessages.some(real => 
            real.content === opt.content && 
            real.user_id === opt.user_id &&
            Math.abs(new Date(real.created_at).getTime() - new Date(opt.created_at).getTime()) < 5000
          )
        );
        
        return [...realMessages, ...filteredOptimistic].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    }
  }, [lobbyId, supabase]);

  const fetchInitialData = useCallback(async () => {
    if (!lobbyId || lobbyId === "undefined") {
      setErrorStatus("Invalid Lobby ID.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("tod_lobbies").select("*").eq("id", lobbyId).single();
      if (error) throw error;
      if (isMounted.current) {
        setLobby(data);
        await fetchParticipants();
        await fetchMessages();
      }
    } catch (err: any) {
      if (isMounted.current) setErrorStatus(err.message);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [lobbyId, supabase, fetchParticipants, fetchMessages]);

  useEffect(() => {
    isMounted.current = true;
    fetchInitialData();
    
    // Realtime subscription
    const channel = supabase.channel(`tod_realtime_${lobbyId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tod_lobbies', 
        filter: `id=eq.${lobbyId}` 
      }, (payload) => {
        console.log('Lobby updated:', payload);
        if (payload.new) setLobby(payload.new);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tod_participants', 
        filter: `lobby_id=eq.${lobbyId}` 
      }, () => {
        console.log('Participants changed');
        fetchParticipants();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tod_messages', 
        filter: `lobby_id=eq.${lobbyId}` 
      }, () => {
        console.log('New message received');
        fetchMessages();
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    // Polling as backup (every 3 seconds)
    const pollInterval = setInterval(() => {
      fetchMessages();
      fetchParticipants();
    }, 3000);

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [lobbyId, fetchInitialData, fetchParticipants, fetchMessages, supabase]);

  // --- Helper Actions ---
  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link copied! Share with friends 🎉");
  };

  const pickNextTurn = async () => {
    try {
      const { data, error } = await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
      if (error) {
        console.error('Next turn error:', error);
        toast.error(error.message);
        return;
      }
      
      // Add optimistic system message
      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        lobby_id: lobbyId,
        user_id: profile?.id || '',
        content: "🎯 New round started!",
        message_type: 'system',
        created_at: new Date().toISOString(),
        isOptimistic: true,
        isSent: false
      };
      setMessages(prev => [...prev, optimisticMsg]);

      // Add to database
      await supabase.from("tod_messages").insert({
        lobby_id: lobbyId,
        user_id: profile?.id,
        content: "🎯 New round started!",
        message_type: 'system'
      });

      await fetchInitialData();
      toast.success("Next round started! 🎲");
    } catch (err: any) {
      console.error('Unexpected error:', err);
      toast.error("Failed to start next round");
    }
  };

  const selectMode = async (mode: 'truth' | 'dare') => {
    try {
      const { error } = await supabase.from("tod_lobbies").update({ selected_mode: mode }).eq("id", lobbyId);
      if (error) {
        console.error('Select mode error:', error);
        toast.error("Failed to select mode");
        return;
      }
      
      // Add optimistic system message
      const targetUser = participants.find(p => p.user_id === lobby.current_target_id);
      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        lobby_id: lobbyId,
        user_id: profile?.id || '',
        content: `${targetUser?.profiles?.username} chose ${mode.toUpperCase()}! 🎲`,
        message_type: 'system',
        created_at: new Date().toISOString(),
        isOptimistic: true,
        isSent: false
      };
      setMessages(prev => [...prev, optimisticMsg]);

      // Add to database
      await supabase.from("tod_messages").insert({
        lobby_id: lobbyId,
        user_id: profile?.id,
        content: `${targetUser?.profiles?.username} chose ${mode.toUpperCase()}! 🎲`,
        message_type: 'system'
      });

      // Force refresh lobby state
      const { data } = await supabase.from("tod_lobbies").select("*").eq("id", lobbyId).single();
      if (data) setLobby(data);
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${lobbyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tod-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('tod-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload image");
      return null;
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() && !selectedImage) return;
    
    const isAsker = profile?.id === lobby.current_asker_id;
    const messageType = (isAsker && lobby.selected_mode && !lobby.current_question) 
      ? lobby.selected_mode 
      : 'chat';

    // Create optimistic message
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      lobby_id: lobbyId,
      user_id: profile?.id || '',
      content: messageInput.trim() || "📷 Photo",
      image_url: imagePreview || undefined,
      message_type: messageType,
      created_at: new Date().toISOString(),
      profiles: { username: profile?.username || 'You' },
      isOptimistic: true,
      isSent: false
    };

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMsg]);
    
    // Clear input
    const tempInput = messageInput;
    const tempImage = selectedImage;
    setMessageInput("");
    removeImage();

    setIsUploading(true);
    try {
      let imageUrl = null;
      if (tempImage) {
        imageUrl = await uploadImage(tempImage);
        if (!imageUrl) {
          // Remove optimistic message on upload failure
          setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
          setMessageInput(tempInput);
          setIsUploading(false);
          return;
        }
      }

      const { error } = await supabase.from("tod_messages").insert({
        lobby_id: lobbyId,
        user_id: profile?.id,
        content: tempInput.trim() || "📷 Photo",
        image_url: imageUrl,
        message_type: messageType
      });

      if (error) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        setMessageInput(tempInput);
        toast.error("Failed to send message");
      } else {
        // Mark as sent
        setMessages(prev => prev.map(m => 
          m.id === optimisticMsg.id ? { ...m, isSent: true } : m
        ));
        
        // If this is a truth/dare question, update lobby
        if (messageType === 'truth' || messageType === 'dare') {
          await supabase.from("tod_lobbies").update({ 
            current_question: tempInput.trim() 
          }).eq("id", lobbyId);
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // --- Input Control Logic ---
  const isTarget = profile?.id === lobby?.current_target_id;
  const isAsker = profile?.id === lobby?.current_asker_id;
  const isHost = profile?.id === lobby?.host_id;
  
  // Determine if current user can send messages
  const canSendMessage = () => {
    if (lobby?.status === 'waiting') return true;
    if (lobby?.status !== 'active') return false;
    
    // If no mode selected yet, only target can interact
    if (!lobby?.selected_mode) return false;
    
    // If mode selected but no question yet, only asker can send
    if (lobby?.selected_mode && !lobby?.current_question) {
      return isAsker;
    }
    
    // If question exists, only target can answer (send next message)
    if (lobby?.current_question) {
      return isTarget;
    }
    
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

  // --- View Logic ---
  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-pink-400" />
      <p className="text-slate-300 font-semibold animate-pulse">Loading game...</p>
    </div>
  );

  if (errorStatus || !lobby) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      <AlertCircle className="w-16 h-16 text-pink-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2 text-white">Lobby Error</h2>
      <p className="text-slate-400 mb-6">{errorStatus || "Game not found."}</p>
      <button 
        onClick={() => window.location.reload()} 
        className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-pink-500/50 transition"
      >
        Retry
      </button>
    </div>
  );

  const targetUser = participants.find(p => p.user_id === lobby.current_target_id);
  const askerUser = participants.find(p => p.user_id === lobby.current_asker_id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 bg-pink-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        {/* Top Header - Compact on mobile */}
        <header className="flex-shrink-0 px-4 py-3 backdrop-blur-xl bg-slate-900/50 border-b border-slate-800/50">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            {/* Players count */}
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                <Users size={16} className="text-white" />
              </div>
              <span className="text-white font-bold hidden sm:inline">{participants.length} Players</span>
              <span className="text-white font-bold sm:hidden">{participants.length}</span>
            </div>

            {/* Game Status */}
            {lobby.status === 'active' && lobby.selected_mode && (
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <div className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                  {askerUser?.profiles?.username || 'Asker'}
                </div>
                <ArrowRight size={16} className="text-slate-600 hidden sm:block" />
                <div className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30">
                  {targetUser?.profiles?.username || 'Target'}
                </div>
              </div>
            )}

            {/* Invite button */}
            <button 
              onClick={copyInviteLink}
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-pink-500/50 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <UserPlus size={14} />
              <span className="hidden sm:inline">Invite</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row max-w-6xl mx-auto w-full">
          {/* Sidebar - Hidden on mobile, slides in on desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0 p-4 overflow-y-auto">
            {/* Players List */}
            <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-4 mb-4 border border-slate-800/50">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-2">
                <Sparkles size={12} className="text-purple-400" />
                Players
              </h3>
              <div className="space-y-2">
                {participants.map((p) => (
                  <div 
                    key={p.user_id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                      p.user_id === lobby.current_target_id 
                        ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30' 
                        : 'bg-slate-800/30'
                    }`}
                  >
                    {p.user_id === lobby.host_id && (
                      <Crown size={12} className="text-amber-400" />
                    )}
                    <span className="text-sm font-semibold text-white truncate flex-1">
                      {p.profiles?.username}
                    </span>
                    {p.has_gone_this_round && (
                      <CheckCircle2 size={14} className="text-green-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Game Log */}
            <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-4 border border-slate-800/50 max-h-[400px] overflow-y-auto">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-2">
                <Flame size={12} className="text-pink-400" />
                Activity
              </h3>
              <div className="space-y-2">
                {messages
                  .filter(m => m.message_type === 'system' || m.message_type === 'truth' || m.message_type === 'dare')
                  .slice(-10)
                  .map((msg) => (
                    <div 
                      key={msg.id}
                      className={`p-2.5 rounded-lg text-xs ${
                        msg.message_type === 'system' 
                          ? 'bg-slate-800/50 text-slate-300' 
                          : msg.message_type === 'truth'
                          ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                          : 'bg-pink-500/10 text-pink-300 border border-pink-500/20'
                               }`}
                    >
                      {msg.message_type !== 'system' && (
                        <div className="flex items-center gap-1 mb-1">
                          {msg.message_type === 'truth' ? <Skull size={10} /> : <Flame size={10} />}
                          <span className="font-bold uppercase opacity-70" style={{ fontSize: '9px' }}>
                            {msg.message_type}
                          </span>
                        </div>
                      )}
                      <p className="font-medium leading-snug">
                        {msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content}
                      </p>
                    </div>
                  ))}
                {messages.filter(m => m.message_type !== 'chat').length === 0 && (
                  <p className="text-slate-500 text-center py-6 text-xs italic">No activity yet</p>
                )}
              </div>
            </div>
          </aside>

          {/* Chat Area */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {/* Waiting State */}
              {lobby.status === 'waiting' && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-pink-500/30">
                    <Sparkles size={32} className="text-pink-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Waiting for Players</h3>
                  <p className="text-slate-400 text-sm mb-6">Invite friends to start the game!</p>
                  {isHost && participants.length >= 2 && (
                    <button 
                      onClick={pickNextTurn}
                      className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-pink-500/50 transition-all active:scale-95"
                    >
                      START GAME
                    </button>
                  )}
                </div>
              )}

              {/* Mode Selection */}
              {lobby.status === 'active' && !lobby.selected_mode && isTarget && (
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-3xl p-6 sm:p-8 text-center border-2 border-dashed border-pink-500/30 backdrop-blur-sm">
                  <h3 className="text-2xl sm:text-3xl font-black text-white mb-6 italic">
                    Pick your poison...
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                      onClick={() => selectMode('truth')}
                      className="group px-6 sm:px-8 py-4 bg-purple-500/20 border-2 border-purple-500 text-purple-300 rounded-2xl font-black text-lg hover:bg-purple-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3 backdrop-blur-sm"
                    >
                      <Skull className="group-hover:rotate-12 transition-transform" size={24} />
                      TRUTH
                    </button>
                    <button 
                      onClick={() => selectMode('dare')}
                      className="group px-6 sm:px-8 py-4 bg-pink-500/20 border-2 border-pink-500 text-pink-300 rounded-2xl font-black text-lg hover:bg-pink-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3 backdrop-blur-sm"
                    >
                      <Flame className="group-hover:animate-bounce" size={24} />
                      DARE
                    </button>
                  </div>
                </div>
              )}

              {/* Mode selected but waiting */}
              {lobby.status === 'active' && !lobby.selected_mode && !isTarget && (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-pulse" />
                  <p className="text-slate-300 text-lg font-semibold">
                    Waiting for {targetUser?.profiles?.username} to choose...
                  </p>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg) => {
                const isOwn = msg.user_id === profile?.id;
                const isSystemMsg = msg.message_type === 'system';
                const isTruthDare = msg.message_type === 'truth' || msg.message_type === 'dare';

                if (isSystemMsg) {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <div className="px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-full text-xs font-bold text-slate-300 border border-slate-700/50">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                if (isTruthDare) {
                  return (
                    <div key={msg.id} className="flex justify-center my-6">
                      <div className={`max-w-lg w-full p-6 rounded-3xl border-2 backdrop-blur-md ${
                        msg.message_type === 'truth' 
                          ? 'bg-purple-500/10 border-purple-500/50' 
                          : 'bg-pink-500/10 border-pink-500/50'
                      }`}>
                        <div className="flex items-center gap-2 mb-3">
                          {msg.message_type === 'truth' ? (
                            <Skull size={20} className="text-purple-400" />
                          ) : (
                            <Flame size={20} className="text-pink-400" />
                          )}
                          <span className={`text-xs font-black uppercase ${
                            msg.message_type === 'truth' ? 'text-purple-400' : 'text-pink-400'
                          }`}>
                            {msg.message_type} Challenge
                          </span>
                        </div>
                        <p className="text-lg font-bold text-white italic leading-relaxed">
                          "{msg.content}"
                        </p>
                        {msg.image_url && (
                          <img 
                            src={msg.image_url} 
                            alt="Challenge" 
                            className="mt-4 rounded-2xl max-h-64 object-cover w-full"
                          />
                        )}
                        <p className="text-xs text-slate-400 mt-3">
                          from {msg.profiles?.username}
                        </p>
                      </div>
                    </div>
                  );
                }

                // Regular chat message
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                    <div className={`max-w-[75%] sm:max-w-xs ${
                      isOwn 
                        ? 'bg-gradient-to-br from-pink-500 to-purple-500 text-white' 
                        : 'bg-slate-800/80 backdrop-blur-sm text-white border border-slate-700/50'
                    } rounded-2xl px-4 py-3 shadow-lg`}>
                      {!isOwn && (
                        <p className="text-xs font-bold opacity-70 mb-1">
                          {msg.profiles?.username}
                        </p>
                      )}
                      {msg.image_url && (
                        <img 
                          src={msg.image_url} 
                          alt="Shared" 
                          className="rounded-xl mb-2 max-h-48 object-cover w-full"
                        />
                      )}
                      <p className="text-sm break-words leading-relaxed">
                        {msg.content}
                      </p>
                      <div className="flex items-center justify-between mt-1.5 gap-2">
                        <p className="text-xs opacity-60">
                          {new Date(msg.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                        {isOwn && (
                          <div className="flex items-center">
                            {msg.isOptimistic && !msg.isSent ? (
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
              })}

              {/* Next Round Button */}
              {lobby.status === 'active' && lobby.current_question && isHost && (
                <div className="flex justify-center pt-6">
                  <button 
                    onClick={pickNextTurn}
                    className="group bg-gradient-to-r from-pink-500 to-purple-500 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-pink-500/50 transition-all active:scale-95"
                  >
                    NEXT ROUND
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 p-3 sm:p-4 backdrop-blur-xl bg-slate-900/80 border-t border-slate-800/50">
              {/* Image Preview */}
              {imagePreview && (
                <div className="mb-3 relative inline-block">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="h-20 rounded-xl object-cover border-2 border-pink-500/50"
                  />
                  <button 
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-pink-500 text-white rounded-full p-1.5 hover:bg-pink-600 transition active:scale-90"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Disabled State Message */}
              {!canSendMessage() && lobby.status === 'active' && (
                <div className="mb-2 text-center">
                  <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Clock size={12} />
                    {getInputPlaceholder()}
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
                  disabled={!canSendMessage()}
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canSendMessage()}
                  className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition shrink-0 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
                >
                  <ImageIcon size={20} className="text-slate-300" />
                </button>

                <textarea
                  ref={textareaRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={getInputPlaceholder()}
                  disabled={!canSendMessage()}
                  className="flex-1 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-pink-500 transition resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  rows={1}
                  style={{ maxHeight: '120px' }}
                />

                <button 
                  onClick={sendMessage}
                  disabled={(!messageInput.trim() && !selectedImage) || isUploading || !canSendMessage()}
                  className="p-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:shadow-lg hover:shadow-pink-500/50 transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0 active:scale-90"
                >
                  {isUploading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
              }
                
