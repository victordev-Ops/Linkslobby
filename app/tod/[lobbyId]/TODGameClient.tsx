"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { 
  Users, Sparkles, Send, ArrowRight, 
  Skull, Flame, Loader2, ShieldAlert, AlertCircle,
  Copy, Crown, CheckCircle2, UserPlus, Info
} from "lucide-react";

export default function TODGameClient({ lobbyId }: { lobbyId: string }) {
  const { profile } = useAuth();
  const [supabase] = useState(() => createClient());
  
  const [lobby, setLobby] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [questionInput, setQuestionInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const isMounted = useRef(true);

  // --- Data Fetching ---
  const fetchParticipants = useCallback(async () => {
    if (!lobbyId || lobbyId === "undefined") return;
    const { data, error } = await supabase
      .from("tod_participants")
      .select("user_id, has_gone_this_round, profiles(username)")
      .eq("lobby_id", lobbyId);
    if (!error && isMounted.current) setParticipants(data || []);
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
      }
    } catch (err: any) {
      if (isMounted.current) setErrorStatus(err.message);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [lobbyId, supabase, fetchParticipants]);

  useEffect(() => {
    isMounted.current = true;
    fetchInitialData();
    const channel = supabase.channel(`tod_realtime_${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tod_lobbies', filter: `id=eq.${lobbyId}` }, 
        (payload) => setLobby(payload.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tod_participants', filter: `lobby_id=eq.${lobbyId}` }, 
        () => fetchParticipants())
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [lobbyId, fetchInitialData, fetchParticipants, supabase]);

  // --- Helper Actions ---
  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link copied! Send it to your friends.");
  };

  const pickNextTurn = async () => {
    const { error } = await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
    if (error) toast.error(error.message);
  };

  const selectMode = async (mode: 'truth' | 'dare') => {
    await supabase.from("tod_lobbies").update({ selected_mode: mode }).eq("id", lobbyId);
  };

  const submitQuestion = async () => {
    if (!questionInput.trim()) return;
    const { error } = await supabase.from("tod_lobbies").update({ current_question: questionInput }).eq("id", lobbyId);
    if (!error) setQuestionInput("");
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
          <div className="bg-white rounded-[2rem] shadow-sm p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-rose-500" />
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Players ({participants.length})</h2>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {participants.map((p) => (
                <div key={p.user_id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${p.user_id === lobby.current_target_id ? 'border-rose-200 bg-rose-50 ring-2 ring-rose-100' : 'border-slate-50 bg-slate-50/50'}`}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    {p.user_id === lobby.host_id && <Crown size={14} className="text-amber-500 shrink-0" />}
                    <span className={`text-sm font-bold truncate ${p.user_id === lobby.current_target_id ? 'text-rose-600' : 'text-slate-700'}`}>
                      {p.profiles?.username}
                    </span>
                  </div>
                  {p.has_gone_this_round && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
                </div>
              ))}
            </div>

            <button onClick={copyInviteLink} className="w-full py-4 px-4 rounded-2xl bg-slate-900 text-white text-xs font-black flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-lg shadow-slate-200">
              <UserPlus size={16} /> INVITE FRIENDS
            </button>
          </div>
        </div>

        {/* MAIN GAME BOARD */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-sm p-8 border border-slate-100 flex flex-col items-center justify-center min-h-[550px] relative overflow-hidden">
          
          {lobby.status === 'waiting' ? (
            <div className="text-center animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6">
                <Sparkles size={40} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 mb-2">The Lobby is Open</h1>
              <p className="text-slate-400 text-sm mb-8">Waiting for players to join the party...</p>
              {isHost ? (
                <button onClick={pickNextTurn} disabled={participants.length < 2} className="bg-rose-500 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-rose-200 hover:scale-105 transition disabled:opacity-50">
                  {participants.length < 2 ? "NEED MORE PLAYERS" : "START FIRST ROUND"}
                </button>
              ) : (
                <div className="flex items-center gap-2 text-rose-500 font-bold justify-center">
                  <Loader2 className="animate-spin" size={20} /> WAITING FOR HOST...
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-2xl space-y-12 animate-in fade-in duration-700">
              {/* Turn Banner */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Asker</p>
                  <div className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase min-w-[140px]">
                    {askerUser?.profiles?.username || "..."}
                  </div>
                </div>
                <ArrowRight className="text-slate-200 mt-4 hidden md:block" size={32} />
                <div className="text-center">
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Target</p>
                  <div className="px-6 py-3 bg-rose-500 text-white rounded-2xl font-black text-sm uppercase shadow-xl shadow-rose-100 min-w-[140px]">
                    {targetUser?.profiles?.username || "..."}
                  </div>
                </div>
              </div>

              {/* Game Stages */}
              <div className="bg-slate-50/50 rounded-[3rem] p-10 border border-slate-100 text-center relative">
                {!lobby.selected_mode ? (
                  <div className="space-y-8">
                    <h2 className="text-2xl font-black text-slate-800 italic">"Pick your poison..."</h2>
                    {isTarget ? (
                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={() => selectMode('truth')} className="group px-12 py-6 bg-white border-4 border-purple-500 text-purple-600 rounded-[2rem] font-black text-xl hover:bg-purple-500 hover:text-white transition-all active:scale-95 flex items-center gap-3">
                          <Skull className="group-hover:rotate-12 transition-transform" /> TRUTH
                        </button>
                        <button onClick={() => selectMode('dare')} className="group px-12 py-6 bg-white border-4 border-rose-500 text-rose-600 rounded-[2rem] font-black text-xl hover:bg-rose-500 hover:text-white transition-all active:scale-95 flex items-center gap-3">
                          <Flame className="group-hover:animate-bounce" /> DARE
                        </button>
                      </div>
                    ) : (
                      <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-slate-300" size={32} />
                        <p className="text-slate-400 font-bold text-sm uppercase">{targetUser?.profiles?.username} is choosing...</p>
                      </div>
                    )}
                  </div>
                ) : !lobby.current_question ? (
                  <div className="space-y-6">
                    <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${lobby.selected_mode === 'truth' ? 'bg-purple-100 text-purple-600' : 'bg-rose-100 text-rose-600'}`}>
                      MODE: {lobby.selected_mode}
                    </div>
                    {isAsker ? (
                      <div className="space-y-4">
                        <textarea 
                          value={questionInput} 
                          onChange={(e) => setQuestionInput(e.target.value)}
                          placeholder={`Ask ${targetUser?.profiles?.username} a ${lobby.selected_mode}...`}
                          className="w-full p-8 rounded-[2rem] border-2 border-slate-200 outline-none focus:border-rose-500 transition-all text-lg font-medium shadow-inner resize-none"
                          rows={3}
                        />
                        <button onClick={submitQuestion} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-2 shadow-xl hover:bg-slate-800 active:scale-95 transition">
                          SEND CHALLENGE <Send size={20} />
                        </button>
                      </div>
                    ) : (
                      <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-slate-300" size={32} />
                        <p className="text-slate-400 font-bold text-sm uppercase">{askerUser?.profiles?.username} is writing a {lobby.selected_mode}...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-10 py-4">
                    <div className="relative p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm">
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase">The Challenge</div>
                      <p className="text-3xl font-black text-slate-800 leading-tight italic">"{lobby.current_question}"</p>
                    </div>
                    {isHost && (
                      <button onClick={pickNextTurn} className="group bg-rose-500 text-white px-12 py-5 rounded-[1.5rem] font-black flex items-center justify-center gap-2 mx-auto hover:bg-rose-600 transition shadow-lg shadow-rose-200">
                        NEXT ROUND <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
