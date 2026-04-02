"use client"
import { ArrowLeft, Loader2, Monitor, Users, UserPlus, History, Star, Swords } from "lucide-react"
import type { useRPSEngine } from "../hooks/useRPSEngine"
import { useRouter } from "next/navigation"

export function RPSLobby({ engine }: { engine: ReturnType<typeof useRPSEngine> }) {
    const router = useRouter()
    
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-600/10 blur-[100px] rounded-full" />
            </div>

            <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.push("/dashboard")} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                    <Swords size={18} className="text-emerald-500" />
                    <h2 className="font-bold text-sm">Rock Paper Scissors</h2>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <button onClick={engine.handleLoadHistory} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition">
                        <History size={16} />
                    </button>
                    {engine.starBalance !== null && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 rounded-full text-amber-400 text-xs font-bold">
                            <Star size={12} />
                            {engine.starBalance}
                        </div>
                    )}
                </div>
            </div>

            <main className="max-w-md mx-auto p-6 space-y-8 relative z-10 pt-12">
                <div className="text-center space-y-3">
                    <div className="text-6xl animate-bounce">✊✋✌️</div>
                    <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                        Rock Paper Scissors
                    </h1>
                    <p className="text-white/50 text-sm max-w-[260px] mx-auto">Best of 5 rounds. First to 3 wins!</p>
                </div>

                <div className="space-y-3">
                    <button onClick={() => engine.handleModeSelect("solo")} disabled={engine.isLoading} className="w-full p-5 bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all active:scale-[0.98] group disabled:opacity-60">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Monitor size={28} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-lg text-white">vs Computer</h3>
                                <p className="text-xs text-white/40">Quick solo match against AI</p>
                            </div>
                            {engine.isLoading && <Loader2 size={18} className="text-white/40 animate-spin ml-auto" />}
                        </div>
                    </button>

                    <button onClick={() => engine.handleModeSelect("friend")} disabled={engine.isLoading} className="w-full p-5 bg-white/5 hover:bg-teal-500/10 border border-white/10 hover:border-teal-500/30 rounded-2xl transition-all active:scale-[0.98] group disabled:opacity-60">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <UserPlus size={28} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-lg text-white">Create Room</h3>
                                <p className="text-xs text-white/40">100 ⭐ escrow required</p>
                            </div>
                        </div>
                    </button>

                    <button onClick={() => engine.setShowJoinInput(!engine.showJoinInput)} className="w-full p-5 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-2xl transition-all active:scale-[0.98] group">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Users size={28} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-lg text-white">Join Room</h3>
                                <p className="text-xs text-white/40">Enter a friend{"'"}s room code</p>
                            </div>
                        </div>
                    </button>

                    {engine.showJoinInput && (
                        <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                            <input
                                value={engine.joinRoomId}
                                onChange={e => engine.setJoinRoomId(e.target.value.toUpperCase())}
                                placeholder="ROOM CODE"
                                maxLength={6}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono text-lg tracking-[0.3em] placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition uppercase"
                            />
                            <button
                                onClick={() => engine.handleJoinRoom(engine.joinRoomId)}
                                disabled={engine.joinRoomId.length !== 6 || engine.isLoading}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                            >
                                {engine.isLoading ? <Loader2 size={18} className="animate-spin" /> : "Join"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Match History Modal */}
                {engine.showHistory && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
                        <div className="bg-[#14141f] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-xl text-white">Match History</h3>
                                <button onClick={() => engine.setShowHistory(false)} className="text-white/40 hover:text-white w-8 h-8 flex items-center justify-center rounded-full bg-white/5">
                                    ✕
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                {engine.isLoadingHistory ? (
                                    <div className="py-12 flex justify-center"><Loader2 size={32} className="text-emerald-400 animate-spin opacity-50" /></div>
                                ) : engine.historyData.length === 0 ? (
                                    <div className="text-center py-12 space-y-2"><div className="text-4xl opacity-50">👻</div><p className="text-white/40 text-sm">No recent matches found</p></div>
                                ) : (
                                    engine.historyData.map((m) => (
                                        <div key={m.match_id} className="bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/5 hover:border-white/10 transition">
                                            <div className="flex items-center gap-3">
                                                {m.opponent_avatar ? (
                                                    <img src={m.opponent_avatar} alt="" className="w-10 h-10 rounded-full object-cover bg-white/10" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                                                        {m.opponent_name.charAt(0).toUpperCase() || "?"}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-sm text-white">
                                                        {m.opponent_name} {m.ai_player && <span className="text-xs text-white/40 font-normal ml-1">🤖</span>}
                                                    </p>
                                                    <p className="text-[10px] text-white/40 font-medium">
                                                        {new Date(m.completed_at || "").toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider mb-1
                                                    ${m.outcome === "won" ? "bg-emerald-500/20 text-emerald-400" 
                                                    : m.outcome === "lost" ? "bg-red-500/20 text-red-400" 
                                                    : "bg-white/10 text-white/50"}`}
                                                >
                                                    {m.outcome.toUpperCase()}
                                                </div>
                                                <span className={`text-xs font-black ${m.xp_change > 0 ? "text-amber-400" : m.xp_change < 0 ? "text-red-400/80" : "text-white/30"}`}>
                                                    {m.xp_change > 0 ? "+" : ""}{m.xp_change} ⭐
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Balance Gate Modal */}
                {engine.showBalanceGate && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <div className="bg-[#14141f] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                                    <Star size={32} className="text-amber-400" />
                                </div>
                                <h3 className="text-xl font-black text-white">Insufficient Stars</h3>
                                <p className="text-white/50 text-sm">
                                    You need <span className="text-amber-400 font-bold">100 Stars</span> to play.
                                    You have <span className="text-amber-400 font-bold">{engine.starBalance} Stars</span>.
                                </p>
                            </div>

                            {engine.starBalance !== null && engine.starBalance > 0 && engine.pendingMode === "solo" ? (
                                <div className="space-y-3">
                                    <button onClick={() => { engine.setShowBalanceGate(false); engine.startMatch("solo", engine.starBalance!) }} disabled={engine.isLoading} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition active:scale-95 disabled:opacity-60">
                                        Play with {engine.starBalance} Stars ⭐
                                    </button>
                                    <button onClick={() => engine.setShowBalanceGate(false)} className="w-full py-3 text-white/40 hover:text-white/60 font-bold text-sm transition">
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-center text-white/40 text-sm">Earn stars by playing other games!</p>
                                    <button onClick={() => engine.setShowBalanceGate(false)} className="w-full py-3 text-white/40 hover:text-white/60 font-bold text-sm transition">
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
