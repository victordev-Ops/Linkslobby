"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { 
  Users, Sparkles, Send, ArrowRight, 
  Skull, Flame, Loader2, AlertCircle,
  Copy, Crown, CheckCircle2, UserPlus, Image as ImageIcon,
  X, Smile
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

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    if (!error && isMounted.current) setMessages(data || []);
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
    toast.success("Link copied! Send it to your friends.");
  };

  const pickNextTurn = async () => {
    try {
      const { data, error } = await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
      if (error) {
        console.error('Next turn error:', error);
        toast.error(error.message);
        return;
      }
      
      // Add system message
      await supabase.from("tod_messages").insert({
        lobby_id: lobbyId,
        user_id: profile?.id,
        content: "🎯 New round started!",
        message_type: 'system'
      });

      // Force refresh
      await fetchInitialData();
      toast.success("Next round started!");
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
      
      // Add system message
      const targetUser = participants.find(p => p.user_id === lobby.current_target_id);
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
    
    setIsUploading(true);
    try {
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
        if (!imageUrl) {
          setIsUploading(false);
          return;
        }
      }

      const isAsker = profile?.id === lobby.current_asker_id;
      const messageType = (isAsker && lobby.selected_mode && !lobby.current_question) 
        ? lobby.selected_mode 
        : 'chat';

      const { error } = await supabase.from("tod_messages").insert({
        lobby_id: lobbyId,
        user_id: profile?.id,
        content: messageInput.trim() || "📷 Photo",
        image_url: imageUrl,
        message_type: messageType
      });

      if (!error) {
        setMessageInput("");
        removeImage();
        
        // If this is a truth/dare question, update lobby
        if (messageType === 'truth' || messageType === 'dare') {
          await supabase.from("tod_lobbies").update({ 
            current_question: messageInput.trim() 
          }).eq("id", lobbyId);
        }
      } else {
        toast.error("Failed to send message");
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

  // --- View Logic ---
  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FD] gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
      <p className="text-slate-500 font-medium animate-pulse">Syncing game state...</p>
    </div>
  );

  if (errorStatus || !lobby) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">Lobby Error</h2>
      <p className="text-slate-500 mb-6">{errorStatus || "Game not found."}</p>
      <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-6 py-2 rounded-xl">Retry</button>
    </div>
  );

  const isHost = profile?.id === lobby.host_id;
  const isTarget = profile?.id === lobby.current_target_id;
  const isAsker = profile?.id === lobby.current_asker_id;
  const targetUser = participants.find(p => p.user_id === lobby.current_target_id);
  const askerUser = participants.find(p => p.user_id === lobby.current_asker_id);

  return (
    <div className="min-h-screen bg-[#F8F9FD] p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT PANEL: PLAYERS & INVITE */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl shadow-sm p-5 border border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-rose-500" />
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Players · {participants.length}
              </h2>
            </div>

            {/* Minimalistic Participant List */}
            <div className="flex flex-wrap gap-2 mb-5">
              {participants.map((p) => (
                <div 
                  key={p.user_id} 
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    p.user_id === lobby.current_target_id 
                      ? 'bg-rose-500 text-white shadow-md' 
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {p.user_id === lobby.host_id && (
                    <Crown size={12} className="text-amber-400" />
                  )}
                  <span className="truncate max-w-[100px]">
                    {p.profiles?.username}
                  </span>
                  {p.has_gone_this_round && (
                    <CheckCircle2 size={12} className="text-green-400" />
                  )}
                </div>
              ))}
            </div>

            <button 
              onClick={copyInviteLink} 
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-md"
            >
              <UserPlus size={14} /> Invite Friends
            </button>
          </div>

          {/* Lobby History Log */}
          <div className="bg-white rounded-3xl shadow-sm p-5 border border-slate-100 max-h-[300px] overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-purple-500" />
              Game Log
            </h3>
            <div className="space-y-2 text-xs">
              {messages
                .filter(m => m.message_type === 'system' || m.message_type === 'truth' || m.message_type === 'dare')
                .slice(-10)
                .map((msg, idx) => (
                  <div 
                    key={msg.id} 
                    className={`p-2 rounded-lg ${
                      msg.message_type === 'system' 
                        ? 'bg-slate-50 text-slate-600' 
                        : msg.message_type === 'truth'
                        ? 'bg-purple-50 text-purple-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {msg.message_type === 'system' ? (
                      <p className="font-medium">{msg.content}</p>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 mb-1">
                          {msg.message_type === 'truth' ? (
                            <Skull size={10} />
                          ) : (
                            <Flame size={10} />
                          )}
                          <span className="font-bold uppercase" style={{ fontSize: '10px' }}>
                            {msg.message_type}
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium leading-tight">
                          {msg.content.length > 60 
                            ? msg.content.substring(0, 60) + '...' 
                            : msg.content}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              {messages.filter(m => m.message_type === 'system' || m.message_type === 'truth' || m.message_type === 'dare').length === 0 && (
                <p className="text-slate-400 text-center py-4 italic">No game events yet</p>
              )}
            </div>
          </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col overflow-hidden h-[calc(100vh-8rem)]">
          
          {/* Chat Header */}
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-purple-50">
            {lobby.status === 'waiting' ? (
              <div className="text-center">
                <h2 className="text-xl font-black text-slate-900 mb-1">Waiting for Players</h2>
                <p className="text-sm text-slate-500">Chat while you wait...</p>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold">
                  <Sparkles size={16} />
                  {askerUser?.profiles?.username}
                </div>
                <ArrowRight className="text-slate-300 hidden md:block" size={20} />
                <div className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-bold">
                  {lobby.selected_mode === 'truth' ? <Skull size={16} /> : <Flame size={16} />}
                  {targetUser?.profiles?.username}
                </div>
                {lobby.selected_mode && (
                  <div className={`px-3 py-1 rounded-full text-xs font-black uppercase ${lobby.selected_mode === 'truth' ? 'bg-purple-100 text-purple-600' : 'bg-rose-100 text-rose-600'}`}>
                    {lobby.selected_mode}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {lobby.status === 'waiting' && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-4">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Game Lobby</h3>
                <p className="text-sm text-slate-500 mb-6">Waiting for more players to join...</p>
                {isHost && participants.length >= 2 && (
                  <button onClick={pickNextTurn} className="bg-rose-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-rose-200 hover:scale-105 transition">
                    START FIRST ROUND
                  </button>
                )}
              </div>
            )}

            {/* Mode Selection Prompt */}
            {lobby.status === 'active' && !lobby.selected_mode && isTarget && (
              <div className="bg-gradient-to-br from-purple-50 to-rose-50 rounded-3xl p-8 text-center border-2 border-dashed border-rose-200">
                <h3 className="text-2xl font-black text-slate-800 mb-6 italic">Pick your poison...</h3>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button onClick={() => selectMode('truth')} className="group px-8 py-4 bg-white border-4 border-purple-500 text-purple-600 rounded-2xl font-black text-lg hover:bg-purple-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3">
                    <Skull className="group-hover:rotate-12 transition-transform" /> TRUTH
                  </button>
                  <button onClick={() => selectMode('dare')} className="group px-8 py-4 bg-white border-4 border-rose-500 text-rose-600 rounded-2xl font-black text-lg hover:bg-rose-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3">
                    <Flame className="group-hover:animate-bounce" /> DARE
                  </button>
                </div>
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
                    <div className="px-4 py-2 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              if (isTruthDare) {
                return (
                  <div key={msg.id} className="flex justify-center my-6">
                    <div className={`max-w-lg w-full p-6 rounded-3xl border-4 ${msg.message_type === 'truth' ? 'bg-purple-50 border-purple-300' : 'bg-rose-50 border-rose-300'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        {msg.message_type === 'truth' ? <Skull size={20} className="text-purple-600" /> : <Flame size={20} className="text-rose-600" />}
                        <span className={`text-xs font-black uppercase ${msg.message_type === 'truth' ? 'text-purple-600' : 'text-rose-600'}`}>
                          {msg.message_type} Challenge
                        </span>
                      </div>
                      <p className="text-lg font-bold text-slate-800 italic">"{msg.content}"</p>
    
