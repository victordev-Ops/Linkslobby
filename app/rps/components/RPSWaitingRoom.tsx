"use client"
import { ArrowLeft, Loader2, Share2, Monitor, Swords } from "lucide-react"
import type { useRPSEngine } from "../hooks/useRPSEngine"

export function RPSWaitingRoom({ engine }: { engine: ReturnType<typeof useRPSEngine> }) {
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-600/10 blur-[100px] rounded-full" />
            </div>

            <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
                <button onClick={engine.handleBack} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition">
                    <ArrowLeft size={20} />
                </button>
                <Swords size={18} className="text-emerald-500" />
                <h2 className="font-bold text-sm">Waiting for Friend</h2>
            </div>

            <main className="max-w-md mx-auto p-6 pt-20 relative z-10 flex flex-col items-center text-center space-y-8">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Loader2 size={40} className="text-emerald-400 animate-spin" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full animate-ping" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white">Share this code</h2>
                    <p className="text-sm text-white/40">Give this code to your friend to join</p>
                </div>

                <div className="bg-white/5 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-xs">
                    <p className="text-4xl font-black font-mono tracking-[0.4em] text-emerald-400 text-center">
                        {engine.roomCode}
                    </p>
                </div>

                <button
                    onClick={engine.handleShareRoom}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition active:scale-95 shadow-lg shadow-emerald-900/30"
                >
                    <Share2 size={18} />
                    Share Invite Link
                </button>

                <div className="w-full max-w-xs space-y-3 pt-4 border-t border-white/5">
                    <p className="text-white/30 text-xs uppercase tracking-wider font-bold">or</p>

                    <button
                        onClick={engine.switchToAI}
                        disabled={engine.isLoading}
                        className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {engine.isLoading ? <Loader2 size={18} className="animate-spin" /> : <Monitor size={18} />}
                        Continue vs AI Instead
                    </button>

                    <button
                        onClick={engine.handleBack}
                        className="w-full py-3 text-white/40 hover:text-white/60 font-bold text-sm transition"
                    >
                        Cancel Match
                    </button>
                </div>
            </main>
        </div>
    )
}
