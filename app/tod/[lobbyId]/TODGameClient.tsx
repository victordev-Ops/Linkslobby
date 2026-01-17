"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { 
  Users, Sparkles, Send, ArrowRight, 
  Skull, Flame, Loader2, ShieldAlert 
} from "lucide-react";

export default function TODGameClient({ lobbyId }: { lobbyId: string }) {
  const { profile } = useAuth();
  const [supabase] = useState(() => createClient());
  
  const [lobby, setLobby] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [questionInput, setQuestionInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Memoized fetchers to prevent unnecessary re-renders
  const fetchParticipants = useCallback(async () => {
    if (!lobbyId || lobbyId === "undefined") return;
    const { data } = await supabase
      .from("tod_participants")
      .select("user_id, has_gone_this_round, profiles(username)")
      .eq("lobby_id", lobbyId);
    setParticipants(data || []);
  }, [lobbyId, supabase]);

  const fetchInitialData = useCallback(async () => {
    if (!lobbyId || lobbyId === "undefined") return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from("tod_lobbies")
      .select("*")
      .eq("id", lobbyId)
      .single();

    if (error) {
      toast.error("Game lobby not found");
      setIsLoading(false);
      return;
    }

    setLobby(data);
    await fetchParticipants();
    setIsLoading(false);
  }, [lobbyId, supabase, fetchParticipants]);

  useEffect(() => {
    // GUARD: Don't run if lobbyId is missing or literally the string "undefined"
    if (!lobbyId || lobbyId === "undefined") return;

    fetchInitialData();

    // Subscribe to Lobby Changes & Participant Updates
    const channel = supabase.channel(`tod-${lobbyId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'tod_lobbies', 
        filter: `id=eq.${lobbyId}` 
      }, (payload) => {
        setLobby(payload.new);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tod_participants', 
        filter: `lobby_id=eq.${lobbyId}` 
      }, () => {
        fetchParticipants();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId, fetchInitialData, fetchParticipants, supabase]);

  // Game Actions
  const pickNextTurn = async () => {
    const { error } = await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
    if (error) toast.error(error.message);
  };

  const selectMode = (mode: 'truth' | 'dare') => 
    supabase.from("tod_lobbies").update({ selected_mode: mode }).eq("id", lobbyId);

  const submitQuestion = async () => {
    if (!questionInput.trim()) return;
    const { error } = await supabase
      .from("tod_lobbies")
      .update({ current_question: questionInput })
      .eq("id", lobbyId);
    
    if (!error) setQuestionInput("");
    else toast.error("Failed to send challenge");
  };

  const endGame = () => 
    supabase.from("tod_lobbies").update({ status: 'ended' }).eq("id", lobbyId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FD] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
        <p className="text-slate-500 font-medium animate-pulse">Syncing game state...</p>
      </div>
    );
  }

  if (!lobby) return <div className="p-10 text-center">Lobby not found.</div>;

  const isHost = profile?.id === lobby.host_id;
  const isTarget = profile?.id === lobby.current_target_id;
  const isAsker = profile?.id === lobby.current_asker_id;
  const targetUser = participants.find(p => p.user_id === lobby.current_target_id);
  const askerUser = participants.find(p => p.user_id === lobby.current_asker_id);

  return (
    <div className="min-h-screen bg-[#F8F9FD] p-4 md:p-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT: PLAYERS PANEL */}
        <div className="lg:col-span-1 bg-white rounded-[2rem] shadow-sm p-6 border border-slate-100 h-fit">
          <div className="flex items-center gap-2 mb-6">
            <Users size={20} className="text-rose-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
              Players ({participants.length})
            </h2>
          </div>
          
          <div className="space-y-3">
            {participants.map((p) => (
              <div 
                key={p.user_id} 
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  p.user_id === lobby.current_target_id 
                  ? 'border-rose-200 bg-rose-50 ring-4 ring-rose-50' 
                  : 'border-slate-50 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${p.user_id === lobby.current_target_id ? 'bg-rose-500 animate-ping' : 'bg-slate-300'}`} />
                  <span className="font-bold text-slate-700 text-sm truncate max-w-[100px]">
                    {p.profiles?.username}
                  </span>
                </div>
                {p.has_gone_this_round && (
                  <span className="text-[8px] bg-green-500 text-white px-2 py-0.5 rounded-full font-black uppercase">In</span>
                )}
              </div>
            ))}
          </div>

          {isHost && (
            <button 
              onClick={endGame} 
              className="mt-8 w-full flex items-center justify-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-tighter hover:text-red-500 transition"
            >
              <ShieldAlert size={14} />
              End Session
            </button>
          )}
        </div>

        {/* CENTER/RIGHT: GAME BOARD */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-sm p-8 border border-slate-100 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
          
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <Flame size={200} />
          </div>

          {lobby.status === 'waiting' ? (
            <div className="text-center relative z-10">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6">
                <Sparkles size={40} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 mb-3">The Lobby is Open</h1>
              <p className="text-slate-500 mb-8 max-w-xs mx-auto text-sm">Waiting for your friends to join the game before we begin.</p>
              {isHost ? (
                <button 
                  onClick={pickNextTurn} 
                  className="bg-rose-600 text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-200 flex items-center gap-2"
                >
                  START FIRST ROUND <ArrowRight size={18} />
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-rose-500" size={24} />
                  <span className="text-rose-500 font-bold text-xs uppercase tracking-widest">Waiting for Host...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full space-y-12 text-center relative z-10">
              {/* Turn Indicator */}
              <div className="flex flex-col md:flex-row justify-center items-center gap-4">
                <div className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase">
                  {askerUser?.profiles?.username || "Asker"}
                </div>
                <div className="text-slate-300 font-black italic tracking-widest">ASKING</div>
                <div className="px-6 py-3 bg-rose-500 text-white rounded-2xl font-black text-sm uppercase shadow-lg shadow-rose-100">
                  {targetUser?.profiles?.username || "Target"}
                </div>
              </div>

              {/* 1. Target chooses Mode */}
              {isTarget && !lobby.selected_mode && (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                  <h3 className="text-2xl font-black text-slate-900 italic">"Pick your poison..."</h3>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                      onClick={() => selectMode('truth')} 
                      className="group bg-white border-4 border-purple-600 text-purple-600 px-12 py-5 rounded-[2rem] text-xl font-black hover:bg-purple-600 hover:text-white transition-all active:scale-95 flex items-center gap-3"
                    >
                      <Skull className="group-hover:rotate-12 transition-transform" /> TRUTH
                    </button>
                    <button 
                      onClick={() => selectMode('dare')} 
                      className="group bg-white border-4 border-rose-600 text-rose-600 px-12 py-5 rounded-[2rem] text-xl font-black hover:bg-rose-600 hover:text-white transition-all active:scale-95 flex items-center gap-3"
                    >
                      <Flame className="group-hover:animate-bounce" /> DARE
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Asker writes question */}
              {lobby.selected_mode && !lobby.current_question && (
                <div className="w-full max-w-md mx-auto animate-in slide-in-from-bottom-4 duration-300">
                  <div className={`mb-6 inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${
                    lobby.selected_mode === 'truth' ? 'bg-purple-100 text-purple-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    CHALLENGE: {lobby.selected_mode}
                  </div>
                  
                  {isAsker ? (
                    <div className="flex flex-col gap-4">
                      <textarea 
                        className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-3xl p-6 focus:border-rose-500 focus:bg-white outline-none transition-all text-slate-700 font-medium resize-none shadow-inner"
                        rows={4}
                        placeholder={`Type a ${lobby.selected_mode} for ${targetUser?.profiles?.username}...`}
                        value={questionInput}
                        onChange={(e) => setQuestionInput(e.target.value)}
                      />
                      <button 
                        onClick={submitQuestion} 
                        className="bg-slate-900 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-xl"
                      >
                        SEND CHALLENGE <Send size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="p-8 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-slate-300" size={32} />
                      <p className="text-slate-400 font-bold text-sm uppercase italic">
                        {askerUser?.profiles?.username} is thinking...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Result Reveal */}
              {lobby.current_question && (
                <div className="space-y-8 animate-in zoom-in-95 duration-500">
                  <div className={`relative p-10 rounded-[3rem] border-2 ${
                    lobby.selected_mode === 'truth' 
                    ? 'bg-purple-50 border-purple-100' 
                    : 'bg-rose-50 border-rose-100'
                  }`}>
                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                      lobby.selected_mode === 'truth' ? 'bg-purple-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                      {lobby.selected_mode}
                    </div>
                    <p className="text-2xl md:text-3xl font-black text-slate-800 leading-tight">
                      "{lobby.current_question}"
                    </p>
                  </div>

                  {isHost && (
                    <button 
                      onClick={pickNextTurn} 
                      className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-xl flex items-center gap-2 mx-auto"
                    >
                      NEXT ROUND <ArrowRight size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
