"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner"; // Optional: for notifications

export default function TODGameClient({ lobbyId }: { lobbyId: string }) {
  const { profile } = useAuth();
  const supabase = createClient();
  
  const [lobby, setLobby] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [questionInput, setQuestionInput] = useState("");

  useEffect(() => {
    fetchInitialData();

    // Subscribe to Lobby Changes & Participant Updates
    const channel = supabase.channel(`tod-${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tod_lobbies', filter: `id=eq.${lobbyId}` }, 
        (payload) => setLobby(payload.new)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tod_participants', filter: `lobby_id=eq.${lobbyId}` }, 
        () => fetchParticipants()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyId]);

  const fetchInitialData = async () => {
    const { data } = await supabase.from("tod_lobbies").select("*").eq("id", lobbyId).single();
    setLobby(data);
    fetchParticipants();
  };

  const fetchParticipants = async () => {
    const { data } = await supabase.from("tod_participants")
      .select("user_id, has_gone_this_round, profiles(username)")
      .eq("lobby_id", lobbyId);
    setParticipants(data || []);
  };

  // Game Actions
  const pickNextTurn = () => supabase.rpc('next_tod_turn', { lobby_uuid: lobbyId });
  const selectMode = (mode: 'truth' | 'dare') => supabase.from("tod_lobbies").update({ selected_mode: mode }).eq("id", lobbyId);
  const submitQuestion = () => {
    if (!questionInput) return;
    supabase.from("tod_lobbies").update({ current_question: questionInput }).eq("id", lobbyId);
    setQuestionInput("");
  };
  const endGame = () => supabase.from("tod_lobbies").update({ status: 'ended' }).eq("id", lobbyId);

  if (!lobby) return <div className="p-10 text-center">Loading game...</div>;

  const isHost = profile?.id === lobby.host_id;
  const isTarget = profile?.id === lobby.current_target_id;
  const isAsker = profile?.id === lobby.current_asker_id;
  const targetUser = participants.find(p => p.user_id === lobby.current_target_id);
  const askerUser = participants.find(p => p.user_id === lobby.current_asker_id);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LEFT: PARTICIPANT LIST */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 h-fit">
          <h2 className="text-lg font-bold mb-4 flex justify-between">
            Players <span>({participants.length})</span>
          </h2>
          <div className="space-y-3">
            {participants.map((p) => (
              <div key={p.user_id} className={`flex items-center justify-between p-3 rounded-lg border ${p.user_id === lobby.current_target_id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-100'}`}>
                <span className="font-medium text-gray-700">{p.profiles?.username}</span>
                {p.has_gone_this_round && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full uppercase font-bold">Done</span>}
              </div>
            ))}
          </div>
          {isHost && (
            <button onClick={endGame} className="mt-6 w-full text-red-500 text-sm font-semibold hover:underline">End Game Session</button>
          )}
        </div>

        {/* RIGHT: GAME BOARD */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-xl p-8 border border-gray-200 flex flex-col items-center justify-center min-h-[400px]">
          {lobby.status === 'waiting' ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Ready to Start?</h1>
              <p className="text-gray-500 mb-6">Waiting for friends to join the lobby...</p>
              {isHost ? (
                <button onClick={pickNextTurn} className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:scale-105 transition">Start First Turn</button>
              ) : (
                <span className="animate-pulse text-blue-600 font-medium">Host is starting the game soon...</span>
              )}
            </div>
          ) : (
            <div className="w-full space-y-8 text-center">
              <div className="flex justify-center items-center gap-4 text-xl">
                <span className="font-bold text-gray-900 underline decoration-blue-500">{askerUser?.profiles?.username || "Asker"}</span>
                <span className="text-gray-400 italic">asking</span>
                <span className="font-bold text-gray-900 underline decoration-orange-500">{targetUser?.profiles?.username || "Target"}</span>
              </div>

              {/* 1. Target chooses Mode */}
              {isTarget && !lobby.selected_mode && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">It's your turn! Pick your poison:</h3>
                  <div className="flex gap-4 justify-center">
                    <button onClick={() => selectMode('truth')} className="bg-purple-600 hover:bg-purple-700 text-white px-10 py-4 rounded-2xl text-lg font-black shadow-lg shadow-purple-200">TRUTH</button>
                    <button onClick={() => selectMode('dare')} className="bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-2xl text-lg font-black shadow-lg shadow-red-200">DARE</button>
                  </div>
                </div>
              )}

              {/* 2. Asker writes question */}
              {lobby.selected_mode && !lobby.current_question && (
                <div className="w-full max-w-md mx-auto">
                  <p className="mb-4 text-gray-600 uppercase tracking-widest font-bold">Challenge: {lobby.selected_mode}</p>
                  {isAsker ? (
                    <div className="flex flex-col gap-3">
                      <textarea 
                        className="w-full border-2 border-gray-200 rounded-xl p-4 focus:border-blue-500 outline-none transition"
                        placeholder={`Enter your ${lobby.selected_mode} question here...`}
                        value={questionInput}
                        onChange={(e) => setQuestionInput(e.target.value)}
                      />
                      <button onClick={submitQuestion} className="bg-green-600 text-white py-3 rounded-xl font-bold">Send Challenge</button>
                    </div>
                  ) : (
                    <p className="animate-pulse text-orange-600">Waiting for {askerUser?.profiles?.username} to write the question...</p>
                  )}
                </div>
              )}

              {/* 3. Result Reveal */}
              {lobby.current_question && (
                <div className="space-y-6">
                  <div className="bg-yellow-50 border-2 border-dashed border-yellow-300 p-8 rounded-3xl">
                    <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold uppercase">{lobby.selected_mode}</span>
                    <p className="text-2xl font-serif italic mt-4">"{lobby.current_question}"</p>
                  </div>
                  {isHost && (
                    <button onClick={pickNextTurn} className="bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition">Next Round →</button>
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
