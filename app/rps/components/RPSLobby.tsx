"use client"
import { useEffect, useState } from "react"
import { ArrowLeft, Loader2, Monitor, Users, UserPlus, History, Star, Swords, X, Ghost, Bot } from "lucide-react"
import type { useRPSEngine } from "../hooks/useRPSEngine"
import { useRouter } from "next/navigation"
import { RPSHandsScene2D } from "./RPSHandsScene2D"

/**
 * Two flat-illustration human hands (skin-tone SVG, not 3D-rigged) face each
 * other and crossfade through rock → paper → scissors poses.
 */
function RPSHandsHero() {
    const [reduceMotion, setReduceMotion] = useState(false)

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduceMotion(mq.matches)
        const onChange = () => setReduceMotion(mq.matches)
        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [])

    return (
        <div className="relative w-full max-w-[320px] h-40 mx-auto" aria-hidden="true">
            <RPSHandsScene2D reduceMotion={reduceMotion} />
        </div>
    )
}

export function RPSLobby({ engine }: { engine: ReturnType<typeof useRPSEngine> }) {
    const router = useRouter()

    return (
        <div className="min-h-[100dvh] bg-[#0a0a0f] text-white relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] bg-emerald-600/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-teal-600/10 blur-[100px] rounded-full" />
            </div>

            <header className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-3 py-2.5 flex items-center gap-2">
                <button
                    onClick={() => router.push("/dashboard")}
                    aria-label="Back to dashboard"
                    className="p-2 -ml-1 rounded-full text-white/60 hover:text-white hover:bg-white/5 active:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-2 min-w-0">
                    <Swords size={16} className="text-emerald-500 shrink-0" />
                    <h1 className="font-bold text-sm truncate">Rock Paper Scissors</h1>
                </div>
                <div className="flex items-center gap-2 ml-auto shrink-0">
                    <button
                        onClick={engine.handleLoadHistory}
                        aria-label="Match history"
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                    >
                        <History size={16} />
                    </button>
                    {engine.starBalance !== null && (
                        <div className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 rounded-full text-amber-400 text-xs font-bold">
                            <Star size={12} fill="currentColor" />
                            {engine.starBalance}
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 pt-7 pb-10 space-y-7 relative z-10">
                <div className="text-center space-y-3">
                    <RPSHandsHero />
                    <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                        Rock Paper Scissors
                    </h2>
                    <p className="text-white/50 text-sm max-w-[260px] mx-auto">Best of 5 rounds. First to 3 wins!</p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => engine.handleModeSelect("solo")}
                        disabled={engine.isLoading}
                        className="w-full p-4 sm:p-5 bg-white/5 hover:bg-emerald-500/10 active:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all active:scale-[0.98] group disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Monitor size={24} />
                            </div>
                            <div className="text-left min-w-0">
                                <h3 className="font-bold text-base sm:text-lg text-white">vs Computer</h3>
                                <p className="text-xs text-white/40">Quick solo match against AI</p>
                            </div>
                            {engine.isLoading && <Loader2 size={18} className="text-white/40 animate-spin ml-auto shrink-0" />}
                        </div>
                    </button>

                    <button
                        onClick={() => engine.handleModeSelect("friend")}
                        disabled={engine.isLoading}
                        className="w-full p-4 sm:p-5 bg-white/5 hover:bg-teal-500/10 active:bg-teal-500/15 border border-white/10 hover:border-teal-500/30 rounded-2xl transition-all active:scale-[0.98] group disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <UserPlus size={24} />
                            </div>
                            <div className="text-left min-w-0">
                                <h3 className="font-bold text-base sm:text-lg text-white">Create Room</h3>
                                <p className="text-xs text-white/40 flex items-center gap-1">
                                    100 <Star size={11} className="text-amber-400" fill="currentColor" /> escrow required
                                </p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => engine.setShowJoinInput(!engine.showJoinInput)}
                        aria-expanded={engine.showJoinInput}
                        className="w-full p-4 sm:p-5 bg-white/5 hover:bg-cyan-500/10 active:bg-cyan-500/15 border border-white/10 hover:border-cyan-500/30 rounded-2xl transition-all active:scale-[0.98] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Users size={24} />
                            </div>
                            <div className="text-left min-w-0">
                                <h3 className="font-bold text-base sm:text-lg text-white">Join Room</h3>
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
                                inputMode="text"
                                autoCapitalize="characters"
                                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono text-lg tracking-[0.3em] placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition uppercase"
                            />
                            <button
                                onClick={() => engine.handleJoinRoom(engine.joinRoomId)}
                                disabled={engine.joinRoomId.length !== 6 || engine.isLoading}
                                className="shrink-0 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                            >
                                {engine.isLoading ? <Loader2 size={18} className="animate-spin" /> : "Join"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Match History Modal */}
                {engine.showHistory && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6">
                        <div className="bg-[#14141f] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
                            <div className="flex justify-between items-center mb-5 sm:mb-6">
                                <h3 className="font-bold text-lg sm:text-xl text-white">Match History</h3>
                                <button
                                    onClick={() => engine.setShowHistory(false)}
                                    aria-label="Close match history"
                                    className="text-white/40 hover:text-white w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                                {engine.isLoadingHistory ? (
                                    <div className="py-12 flex justify-center"><Loader2 size={32} className="text-emerald-400 animate-spin opacity-50" /></div>
                                ) : engine.historyData.length === 0 ? (
                                    <div className="text-center py-12 space-y-2">
                                        <Ghost size={32} className="mx-auto text-white/20" />
                                        <p className="text-white/40 text-sm">No recent matches found</p>
                                    </div>
                                ) : (
                                    engine.historyData.map((m) => (
                                        <div key={m.match_id} className="bg-white/5 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between border border-white/5 hover:border-white/10 transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {m.opponent_avatar ? (
                                                    <img src={m.opponent_avatar} alt="" className="w-10 h-10 rounded-full object-cover bg-white/10 shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">
                                                        {m.opponent_name.charAt(0).toUpperCase() || "?"}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-white flex items-center gap-1 truncate">
                                                        <span className="truncate">{m.opponent_name}</span>
                                                        {m.ai_player && <Bot size={12} className="text-white/40 shrink-0" />}
                                                    </p>
                                                    <p className="text-[10px] text-white/40 font-medium">
                                                        {new Date(m.completed_at || "").toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end shrink-0 ml-2">
                                                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider mb-1
                                                    ${m.outcome === "won" ? "bg-emerald-500/20 text-emerald-400"
                                                        : m.outcome === "lost" ? "bg-red-500/20 text-red-400"
                                                            : "bg-white/10 text-white/50"}`}
                                                >
                                                    {m.outcome.toUpperCase()}
                                                </div>
                                                <span className={`flex items-center gap-0.5 text-xs font-black ${m.xp_change > 0 ? "text-amber-400" : m.xp_change < 0 ? "text-red-400/80" : "text-white/30"}`}>
                                                    {m.xp_change > 0 ? "+" : ""}{m.xp_change} <Star size={10} fill="currentColor" />
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
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6">
                        <div className="bg-[#14141f] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                                    <Star size={32} className="text-amber-400" fill="currentColor" />
                                </div>
                                <h3 className="text-xl font-black text-white">Insufficient Stars</h3>
                                <p className="text-white/50 text-sm">
                                    You need <span className="text-amber-400 font-bold">100 Stars</span> to play.
                                    You have <span className="text-amber-400 font-bold">{engine.starBalance} Stars</span>.
                                </p>
                            </div>

                            {engine.starBalance !== null && engine.starBalance > 0 && engine.pendingMode === "solo" ? (
                                <div className="space-y-3">
                                    <button
                                        onClick={() => { engine.setShowBalanceGate(false); engine.startMatch("solo", engine.starBalance!) }}
                                        disabled={engine.isLoading}
                                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                                    >
                                        Play with {engine.starBalance} <Star size={14} fill="currentColor" />
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
