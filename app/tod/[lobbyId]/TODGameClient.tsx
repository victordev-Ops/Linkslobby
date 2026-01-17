"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { 
  Users, Sparkles, Send, ArrowRight, 
  Skull, Flame, Loader2, ShieldAlert, AlertCircle,
  Copy, CheckCircle2, Crown, UserPlus
} from "lucide-react";

export default function TODGameClient({ lobbyId }: { lobbyId: string }) {
  // ... (Keep all your existing state and useEffect logic exactly as they are)

  // NEW: Share Link Function
  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied to clipboard!");
  };

  // ... (Keep all your existing handlers: pickNextTurn, selectMode, submitQuestion)

  if (isLoading) { /* ... keep existing loading UI ... */ }
  if (errorStatus || !lobby) { /* ... keep existing error UI ... */ }

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
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Players ({participants.length})
                </h2>
              </div>
            </div>
            
            <div className="space-y-2 mb-6">
              {participants.map((p) => (
                <div 
                  key={p.user_id} 
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    p.user_id === lobby.current_target_id 
                    ? 'border-rose-200 bg-rose-50 ring-2 ring-rose-100' 
                    : 'border-slate-50 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {p.user_id === lobby.host_id && <Crown size={12} className="text-amber-500 shrink-0" />}
                    <span className={`text-sm font-bold truncate ${p.user_id === lobby.current_target_id ? 'text-rose-600' : 'text-slate-700'}`}>
                      {p.profiles?.username}
                    </span>
                  </div>
                  {p.has_gone_this_round && <CheckCircle2 size={14} className="text-green-500" />}
                </div>
              ))}
            </div>

            {/* INVITE BUTTON */}
            <button 
              onClick={copyInviteLink}
              className="w-full py-3 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition"
            >
              <UserPlus size={14} />
              Invite Friends
            </button>
          </div>

          {isHost && (
            <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 text-center">Host Controls</p>
              <button onClick={pickNextTurn} className="w-full py-2 bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm mb-2">Next Turn</button>
              <button className="w-full text-rose-400 text-[10px] font-bold hover:underline">End Game</button>
            </div>
          )}
        </div>

        {/* MAIN GAME BOARD */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-sm p-8 border border-slate-100 flex flex-col items-center justify-center min-h-[550px] relative">
          
          {lobby.status === 'waiting' ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6">
                <Sparkles size={40} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 mb-2">Ready to Play?</h1>
              <p className="text-slate-400 text-sm mb-8">Wait for at least 2 players to join...</p>
              {isHost && participants.length >= 2 && (
                <button onClick={pickNextTurn} className="bg-rose-500 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-rose-200 hover:scale-105 transition">
                  START GAME
                </button>
              )}
            </div>
          ) : (
            <div className="w-full max-w-2xl">
              {/* Turn Banner */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-12">
                <div className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase">
                  {askerUser?.profiles?.username}
                </div>
                <ArrowRight className="text-slate-300 hidden md:block" />
                <div className="px-6 py-3 bg-rose-500 text-white rounded-2xl font-black text-sm uppercase">
                  {targetUser?.profiles?.username}
                </div>
              </div>

              {/* Game Flow Logic */}
              <div className="bg-slate-50/50 rounded-[3rem] p-10 border border-slate-100 text-center">
                {!lobby.selected_mode ? (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-800">Choose a Mode</h2>
                    {isTarget ? (
                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={() => selectMode('truth')} className="px-12 py-5 bg-white border-4 border-purple-500 text-purple-600 rounded-[2rem] font-black text-xl hover:bg-purple-500 hover:text-white transition">TRUTH</button>
                        <button onClick={() => selectMode('dare')} className="px-12 py-5 bg-white border-4 border-rose-500 text-rose-600 rounded-[2rem] font-black text-xl hover:bg-rose-500 hover:text-white transition">DARE</button>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic font-medium animate-pulse">Waiting for {targetUser?.profiles?.username} to pick...</p>
                    )}
                  </div>
                ) : !lobby.current_question ? (
                  <div className="space-y-6">
                    <span className="px-4 py-1 bg-slate-200 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      MODE: {lobby.selected_mode}
                    </span>
                    {isAsker ? (
                      <div className="space-y-4">
                        <textarea 
                          value={questionInput} 
                          onChange={(e) => setQuestionInput(e.target.value)}
                          placeholder={`Enter a ${lobby.selected_mode}...`}
                          className="w-full p-6 rounded-[2rem] border-2 border-slate-200 outline-none focus:border-rose-500 transition text-lg font-medium"
                          rows={3}
                        />
                        <button onClick={submitQuestion} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl">
                          SEND CHALLENGE <Send size={18} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic font-medium animate-pulse">Waiting for {askerUser?.profiles?.username} to write...</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="relative">
                      <div className="text-6xl absolute -top-10 left-0 opacity-10 font-serif">“</div>
                      <p className="text-3xl font-black text-slate-800 leading-tight italic px-6">
                        {lobby.current_question}
                      </p>
                    </div>
                    {isHost && (
                      <button onClick={pickNextTurn} className="bg-rose-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-rose-600 transition">
                        Finish Turn & Next Round
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
