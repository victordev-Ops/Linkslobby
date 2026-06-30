"use client"
import { useEffect, useState } from "react"
import { ArrowLeft, Loader2, Monitor, Users, UserPlus, History, Star, Swords, X, Ghost, Bot } from "lucide-react"
import type { useRPSEngine } from "../hooks/useRPSEngine"
import { useRouter } from "next/navigation"

// Same 9-point topology (cuff → palm → thumb → web → tipA → mid-web → tipB → palm → cuff)
// smoothed with Catmull-Rom-to-Bezier, so the browser tweens point-for-point between
// shapes instead of cross-fading — the hand silhouette actually reshapes itself.
const HAND_PATHS = {
    rock: "M -10.00,30.00 C -5.67,20.67 8.67,17.67 16.00,14.00 C 23.33,10.33 28.00,8.00 34.00,8.00 C 40.00,8.00 45.67,12.67 52.00,14.00 C 58.33,15.33 67.67,12.33 72.00,16.00 C 76.33,19.67 77.67,29.00 78.00,36.00 C 78.33,43.00 78.00,51.00 74.00,58.00 C 70.00,65.00 68.00,76.00 54.00,78.00 C 40.00,80.00 0.67,78.00 -10.00,70.00 C -20.67,62.00 -14.33,39.33 -10.00,30.00 Z",
    paper: "M -10.00,30.00 C -6.00,19.33 11.00,15.67 14.00,10.00 C 17.00,4.33 3.00,-6.00 8.00,-4.00 C 13.00,-2.00 28.00,20.67 44.00,22.00 C 60.00,23.33 100.33,1.00 104.00,4.00 C 107.67,7.00 65.33,31.33 66.00,40.00 C 66.67,48.67 111.33,48.67 108.00,56.00 C 104.67,63.33 65.67,81.00 46.00,84.00 C 26.33,87.00 -0.67,83.00 -10.00,74.00 C -19.33,65.00 -14.00,40.67 -10.00,30.00 Z",
    scissors: "M -10.00,28.00 C -5.67,19.00 10.00,17.67 16.00,16.00 C 22.00,14.33 21.67,17.67 26.00,18.00 C 30.33,18.33 28.67,20.67 42.00,18.00 C 55.33,15.33 103.33,-1.67 106.00,2.00 C 108.67,5.67 58.00,30.67 58.00,40.00 C 58.00,49.33 109.00,51.33 106.00,58.00 C 103.00,64.67 59.33,78.00 40.00,80.00 C 20.67,82.00 -1.67,78.67 -10.00,70.00 C -18.33,61.33 -14.33,37.00 -10.00,28.00 Z",
} as const

const MORPH_VALUES = `${HAND_PATHS.rock};${HAND_PATHS.paper};${HAND_PATHS.scissors};${HAND_PATHS.rock}`
const MORPH_KEYTIMES = "0;0.33;0.66;1"
const MORPH_SPLINES = "0.45 0 0.2 1;0.45 0 0.2 1;0.45 0 0.2 1"

/** One 3D-shaded hand: gradient body for form, a clipped gloss highlight + underside
 *  shadow for volume, and an SMIL `d` morph cycling rock → paper → scissors. */
function Hand3D({ side, animate }: { side: "left" | "right"; animate: boolean }) {
    const id = side === "left" ? "lh" : "rh"
    const hueA = side === "left" ? "#6ee7b7" : "#99f6e4"
    const hueB = side === "left" ? "#10b981" : "#2dd4bf"
    const hueC = side === "left" ? "#065f46" : "#0f766e"
    const mirror = side === "right"

    return (
        <div
            className={`w-24 h-24 ${animate ? `rps3d-${side}` : ""}`}
            style={{ perspective: 500, filter: `drop-shadow(0 10px 14px ${side === "left" ? "rgba(16,185,129,0.35)" : "rgba(45,212,191,0.35)"})` }}
        >
            <div className="w-full h-full" style={{ transform: mirror ? "scaleX(-1)" : undefined }}>
                <svg viewBox="-30 -20 145 115" className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id={`${id}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={hueA} />
                            <stop offset="55%" stopColor={hueB} />
                            <stop offset="100%" stopColor={hueC} />
                        </linearGradient>
                        <clipPath id={`${id}-clip`}>
                            <use href={`#${id}-shape`} />
                        </clipPath>
                        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="9" />
                        </filter>
                    </defs>

                    {/* grounding shadow */}
                    <ellipse cx="34" cy="92" rx="44" ry="10" fill="black" opacity="0.28" filter={`url(#${id}-blur)`} />

                    {/* cuff (static — only the hand mass morphs) */}
                    <rect x="-26" y="34" width="34" height="32" rx="15" fill={`url(#${id}-grad)`} opacity="0.9" />

                    {/* morphing hand body */}
                    <path id={`${id}-shape`} d={HAND_PATHS.rock} fill={`url(#${id}-grad)`}>
                        {animate && (
                            <animate
                                attributeName="d"
                                values={MORPH_VALUES}
                                keyTimes={MORPH_KEYTIMES}
                                dur="3s"
                                calcMode="spline"
                                keySplines={MORPH_SPLINES}
                                repeatCount="indefinite"
                            />
                        )}
                    </path>

                    {/* volume: clipped gloss highlight + underside shade, riding along with the morph */}
                    <g clipPath={`url(#${id}-clip)`}>
                        <ellipse cx="22" cy="14" rx="34" ry="20" fill="white" opacity="0.4" filter={`url(#${id}-blur)`} />
                        <ellipse cx="58" cy="70" rx="46" ry="24" fill="black" opacity="0.22" filter={`url(#${id}-blur)`} />
                    </g>
                </svg>
            </div>
        </div>
    )
}

/**
 * Two 3D-shaded hands enter from opposite edges and clash toward a center VS puck.
 * Each hand's silhouette morphs — rock → paper → scissors — rather than cross-fading
 * between flat icons, so it reads as an actual hand reshaping itself mid-throw.
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
        <div className="relative w-full max-w-[300px] h-32 mx-auto select-none" aria-hidden="true" style={{ perspective: 700 }}>
            <style>{`
                @keyframes rps3d-left {
                    0%, 100% { transform: translateX(-14px) translateZ(-14px) rotateY(24deg) rotateX(4deg); }
                    16%, 49%, 83% { transform: translateX(4px) translateZ(12px) rotateY(10deg) rotateX(2deg); }
                }
                @keyframes rps3d-right {
                    0%, 100% { transform: translateX(14px) translateZ(-14px) rotateY(-24deg) rotateX(4deg); }
                    16%, 49%, 83% { transform: translateX(-4px) translateZ(12px) rotateY(-10deg) rotateX(2deg); }
                }
                @keyframes rps-badge-pulse {
                    0%, 100% { transform: scale(0.9) translateZ(0); opacity: 0.75; }
                    16%, 49%, 83% { transform: scale(1.15) translateZ(10px); opacity: 1; }
                }
                .rps3d-left { animation: rps3d-left 3s ease-in-out infinite; transform-style: preserve-3d; }
                .rps3d-right { animation: rps3d-right 3s ease-in-out infinite; transform-style: preserve-3d; }
                .rps-badge { animation: rps-badge-pulse 3s ease-in-out infinite; }
                @media (prefers-reduced-motion: reduce) {
                    .rps3d-left, .rps3d-right, .rps-badge { animation: none !important; transform: none !important; }
                }
            `}</style>

            <div className="absolute inset-0 flex items-center justify-between" style={{ transformStyle: "preserve-3d" }}>
                <Hand3D side="left" animate={!reduceMotion} />

                <div className="rps-badge shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/15 backdrop-blur-sm flex items-center justify-center mx-1 shadow-lg shadow-black/30">
                    <span className="text-[11px] font-black tracking-wider text-white/80">VS</span>
                </div>

                <Hand3D side="right" animate={!reduceMotion} />
            </div>
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
