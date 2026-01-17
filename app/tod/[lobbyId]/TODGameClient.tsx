"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { 
  Users, Sparkles, Send, ArrowRight, 
  Skull, Flame, Loader2, ShieldAlert, AlertCircle 
} from "lucide-react";

export default function TODGameClient({ lobbyId }: { lobbyId: string }) {
  const { profile } = useAuth();
  const [supabase] = useState(() => createClient());
  
  const [lobby, setLobby] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [questionInput, setQuestionInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Use a ref to track if component is mounted to prevent state updates on unmounted component
  const isMounted = useRef(true);

  const fetchParticipants = useCallback(async () => {
    if (!lobbyId || lobbyId === "undefined") return;
    
    console.log("🛠 [Debug] Fetching participants for:", lobbyId);
    const { data, error } = await supabase
      .from("tod_participants")
      .select("user_id, has_gone_this_round, profiles(username)")
      .eq("lobby_id", lobbyId);

    if (error) {
      console.error("❌ [Debug] Participants Error:", error.message);
      return;
    }
    
    if (isMounted.current) setParticipants(data || []);
  }, [lobbyId, supabase]);

  const fetchInitialData = useCallback(async () => {
    // 1. Guard against bad IDs
    if (!lobbyId || lobbyId === "undefined") {
      setErrorStatus("Invalid Lobby ID provided.");
      setIsLoading(false);
      return;
    }
    
    console.log("🚀 [Debug] Starting Initial Fetch...");
    setIsLoading(true);

    try {
      // 2. Fetch Lobby
      const { data: lobbyData, error: lobbyError } = await supabase
        .from("tod_lobbies")
        .select("*")
        .eq("id", lobbyId)
        .single();

      if (lobbyError) throw new Error(`Lobby not found: ${lobbyError.message}`);
      
      if (isMounted.current) {
        setLobby(lobbyData);
        // 3. Fetch Participants immediately after
        await fetchParticipants();
      }

    } catch (err: any) {
      console.error("❌ [Debug] Initial Fetch Failed:", err.message);
      if (isMounted.current) setErrorStatus(err.message);
    } finally {
      // Ensure loading screen is removed even if things fail
      if (isMounted.current) setIsLoading(false);
    }
  }, [lobbyId, supabase, fetchParticipants]);

  useEffect(() => {
    isMounted.current = true;
    fetchInitialData();

    // 4. Subscription Logic
    const channel = supabase.channel(`tod_realtime_${lobbyId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'tod_lobbies', 
        filter: `id=eq.${lobbyId}` 
      }, (payload) => {
        console.log("🔄 [Debug] Lobby Update Received:", payload.new);
        setLobby(payload.new);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tod_participants', 
        filter: `lobby_id=eq.${lobbyId}` 
      }, () => {
        console.log("👥 [Debug] Participants Change Detected");
        fetchParticipants();
      })
      .subscribe((status) => {
        console.log("📡 [Debug] Subscription Status:", status);
      });

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [lobbyId, fetchInitialData, fetchParticipants, supabase]);

  // --- Actions ---
  const pickNextTurn = async () => {
    const { error } = await supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
    if (error) {
      console.error("❌ [Debug] RPC Error:", error);
      toast.error(`Game Error: ${error.message}`);
    }
  };

  const selectMode = async (mode: 'truth' | 'dare') => {
    const { error } = await supabase.from("tod_lobbies").update({ selected_mode: mode }).eq("id", lobbyId);
    if (error) toast.error("Failed to select mode");
  };

  const submitQuestion = async () => {
    if (!questionInput.trim()) return;
    const { error } = await supabase.from("tod_lobbies").update({ current_question: questionInput }).eq("id", lobbyId);
    if (!error) setQuestionInput("");
    else toast.error("Failed to send challenge");
  };

  // --- Render Logic ---

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FD] gap-4">
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
          <div className="absolute inset-0 blur-xl bg-rose-200 opacity-50 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-slate-600 font-bold">Syncing Game State...</p>
          <p className="text-slate-400 text-xs mt-1">Checking ID: {lobbyId}</p>
        </div>
      </div>
    );
  }

  if (errorStatus || !lobby) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
        <div className="bg-rose-50 p-4 rounded-full mb-4">
          <AlertCircle className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-slate-500 text-center max-w-xs mb-6">{errorStatus || "Lobby could not be loaded."}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  const isHost = profile?.id === lobby.host_id;
  const isTarget = profile?.id === lobby.current_target_id;
  const isAsker = profile?.id === lobby.current_asker_id;
  const targetUser = participants.find(p => p.user_id === lobby.current_target_id);
  const askerUser = participants.find(p => p.user_id === lobby.current_asker_id);

  // ... (Keep your existing UI JSX here, it's already styled perfectly)
  return (
      <div className="min-h-screen bg-[#F8F9FD] p-4 md:p-8">
          {/* Your UI code remains unchanged */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* [Existing UI Content] */}
              <div className="lg:col-span-1 bg-white rounded-[2rem] shadow-sm p-6 border border-slate-100 h-fit">
                {/* ... Players Panel Content ... */}
                <div className="flex items-center gap-2 mb-6">
                    <Users size={20} className="text-rose-500" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
                        Players ({participants.length})
                    </h2>
                </div>
                <div className="space-y-3">
                    {participants.map((p) => (
                        <div key={p.user_id} className={`flex items-center justify-between p-3 rounded-2xl border ${p.user_id === lobby.current_target_id ? 'border-rose-200 bg-rose-50' : 'border-slate-50'}`}>
                            <span className="font-bold text-slate-700 text-sm">{p.profiles?.username}</span>
                        </div>
                    ))}
                </div>
              </div>

              <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-sm p-8 border border-slate-100 flex flex-col items-center justify-center min-h-[500px]">
                {/* ... Game Board Content ... */}
                {lobby.status === 'waiting' ? (
                   <div className="text-center">
                       <h1 className="text-3xl font-black text-slate-900">Waiting for players...</h1>
                       {isHost && (
                           <button onClick={pickNextTurn} className="mt-4 bg-rose-600 text-white px-8 py-3 rounded-xl font-bold">Start Game</button>
                       )}
                   </div>
                ) : (
                    <div className="text-center">
                         <p className="text-xl font-bold">{askerUser?.profiles?.username} asking {targetUser?.profiles?.username}</p>
                         {/* Truth/Dare UI Logic */}
                         {isTarget && !lobby.selected_mode && (
                             <div className="flex gap-4 mt-4">
                                 <button onClick={() => selectMode('truth')} className="px-6 py-3 bg-purple-600 text-white rounded-xl">Truth</button>
                                 <button onClick={() => selectMode('dare')} className="px-6 py-3 bg-rose-600 text-white rounded-xl">Dare</button>
                             </div>
                         )}
                         {lobby.selected_mode && !lobby.current_question && isAsker && (
                             <div className="mt-4">
                                 <textarea value={questionInput} onChange={(e) => setQuestionInput(e.target.value)} className="border p-2 rounded w-full" />
                                 <button onClick={submitQuestion} className="bg-black text-white px-4 py-2 rounded mt-2">Send</button>
                             </div>
                         )}
                         {lobby.current_question && (
                             <div className="mt-4 p-6 bg-slate-50 rounded-xl italic">"{lobby.current_question}"</div>
                         )}
                    </div>
                )}
              </div>
          </div>
      </div>
  );
}
