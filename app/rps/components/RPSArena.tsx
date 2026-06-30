"use client"
import React, { useEffect, useRef } from "react"
import { ArrowLeft, AlertTriangle, Loader2, Monitor, RotateCcw, Star, Swords, Zap } from "lucide-react"
import type { useRPSEngine } from "../hooks/useRPSEngine"
import type { RPSMove } from "@/actions/rps"

const CHOICES: { id: RPSMove; emoji: string; label: string }[] = [
    { id: "rock", emoji: "✊", label: "Rock" },
    { id: "paper", emoji: "✋", label: "Paper" },
    { id: "scissors", emoji: "✌️", label: "Scissors" },
]

// 15s disconnect timer (must match DISCONNECT_TIMEOUT_SECONDS in hook)
const DISCONNECT_TIMEOUT_SECONDS = 15

export function RPSArena({ engine }: { engine: ReturnType<typeof useRPSEngine> }) {
    const choiceEmoji = (c: RPSMove | null) => CHOICES.find(x => x.id === c)?.emoji || "❓"
    const opponentLabel = engine.mode === "solo" ? "Computer" : (engine.opponentName || "Opponent")

    const resultColors: Record<string, string> = {
        win: "text-emerald-400",
        lose: "text-red-400",
        tie: "text-yellow-400"
    }
    const resultText: Record<string, string> = {
        win: "You Win!",
        lose: "You Lose!",
        tie: "It's a Tie!"
    }

    // Lightweight confetti implementation (no external deps) -----------------
    const confettiTimeoutRef = useRef<number | null>(null)

    const runConfetti = () => {
        // prevent multiple canvases running at once
        if (confettiTimeoutRef.current) return

        const duration = 1800
        const end = Date.now() + duration

        const colors = ["#4ade80", "#34d399", "#60a5fa", "#f97316", "#f43f5e"]

        const canvas = document.createElement('canvas')
        canvas.style.position = 'fixed'
        canvas.style.top = '0'
        canvas.style.left = '0'
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.pointerEvents = 'none'
        canvas.style.zIndex = '9999'
        document.body.appendChild(canvas)

        const ctx = canvas.getContext('2d')!

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        resize()
        window.addEventListener('resize', resize)

        type Particle = {
            x: number
            y: number
            vx: number
            vy: number
            size: number
            color: string
            rotation: number
            vr: number
        }

        const particles: Particle[] = []
        const count = Math.floor((window.innerWidth / 80)) // scale with screen width

        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: -20 - Math.random() * 200,
                vx: (Math.random() - 0.5) * 6,
                vy: 2 + Math.random() * 6,
                size: 6 + Math.random() * 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.2,
            })
        }

        const gravity = 0.12

        const frame = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            const now = Date.now()

            for (let p of particles) {
                p.vy += gravity
                p.x += p.vx
                p.y += p.vy
                p.rotation += p.vr

                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate(p.rotation)
                ctx.fillStyle = p.color
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
                ctx.restore()
            }

            // keep rendering until time's up or all particles are off-screen
            if (now < end) {
                requestAnimationFrame(frame)
            } else {
                // let remaining particles fall for a bit then cleanup
                confettiTimeoutRef.current = window.setTimeout(() => {
                    window.removeEventListener('resize', resize)
                    if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
                    confettiTimeoutRef.current = null
                }, 400)
            }
        }

        frame()
    }

    useEffect(() => {
        if (engine.matchResult === 'won') {
            // small delay so the match end UI can render first
            const id = window.setTimeout(runConfetti, 150)
            return () => window.clearTimeout(id)
        }
        return
    }, [engine.matchResult])

    // ─── Shared Disconnect Banner Component ───
    // Shows during both 'choosing' and 'waiting' phases
    const DisconnectBanner = ({ compact = false }: { compact?: boolean }) => {
        if (engine.disconnectCountdown === null || engine.disconnectCountdown <= 0) return null

        return (
            <div className={`w-full ${compact ? '' : 'max-w-xs'} space-y-2`}>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-3">
                    <p className="text-amber-400 font-bold text-sm">⚠️ Opponent disconnected</p>
                    <p className="text-white/50 text-xs">AI will take over in {engine.disconnectCountdown}s…</p>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
                            style={{ width: `${(engine.disconnectCountdown / DISCONNECT_TIMEOUT_SECONDS) * 100}%` }}
                        />
                    </div>
                    {/* "Switch to AI now" — skip the wait */}
                    <button
                        onClick={engine.triggerImmediateAI}
                        className="w-full mt-2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5"
                    >
                        <Zap size={14} />
                        Switch to AI Now
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden pb-8">

            {/* ═══════════════════════════════════════════════════════
                EXIT CONFIRMATION — Voluntary Exit / Stake Forfeiture
                Two-step confirmation with clear, irreversible warning.
                Waiting status = refund. Active status = forfeit.
                ═══════════════════════════════════════════════════════ */}
            {engine.showExitConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#12121a] border border-red-500/30 w-full max-w-sm rounded-3xl p-6 space-y-6 shadow-2xl shadow-red-500/10">
                        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                            <AlertTriangle size={32} />
                        </div>
                        <div className="text-center space-y-3">
                            {engine.match?.status === "waiting" ? (
                                <>
                                    <h3 className="text-2xl font-black text-white">Cancel match?</h3>
                                    <p className="text-white/60 text-sm">
                                        Your <span className="text-amber-400 font-bold">{engine.stakeAmount} Stars</span> escrow will be refunded in full.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-2xl font-black text-white">Forfeit match?</h3>
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-1">
                                        <p className="text-red-400 text-sm font-bold">
                                            ⚠️ You will lose your full {engine.stakeAmount} Stars stake
                                        </p>
                                        <p className="text-white/40 text-xs">
                                            Your stake will be transferred to your opponent.
                                            This action is <span className="text-red-400 font-bold">irreversible</span>.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => engine.setShowExitConfirm(false)}
                                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
                            >
                                Stay in Game
                            </button>
                            <button
                                onClick={engine.confirmExit}
                                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
                            >
                                {engine.match?.status === "waiting" ? "Cancel & Refund" : "Forfeit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/8 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-600/8 blur-[100px] rounded-full" />
            </div>

            {/* Header */}
            <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={engine.handleBack} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition">
                        <ArrowLeft size={20} />
                    </button>
                    <Swords size={18} className="text-emerald-500" />
                    <h2 className="font-bold text-sm">Best of 5</h2>
                </div>
                <div className="flex items-center gap-2">
                    {engine.mode === "friend" && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                            <div className={`w-1.5 h-1.5 rounded-full ${engine.aiActive ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                            <span className="text-[10px] font-bold text-emerald-400">
                                vs {opponentLabel} {engine.aiActive && '🤖'}
                            </span>
                        </div>
                    )}
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Round {Math.min(engine.currentRound, 5)}/5</span>
                </div>
            </div>

            <main className="max-w-md mx-auto p-4 space-y-6 relative z-10">
                {/* Scoreboard — scores update only AFTER 3-second countdown */}
                {engine.phase !== "matchEnd" && (
                    <div className="flex items-center justify-center gap-4">
                        <div className="flex-1 text-center p-4 bg-white/5 border border-white/10 rounded-2xl">
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">You</p>
                            <p className="text-4xl font-black text-emerald-400">{engine.playerScore}</p>
                        </div>
                        <div className="text-white/20 font-black text-2xl">:</div>
                        <div className="flex-1 text-center p-4 bg-white/5 border border-white/10 rounded-2xl">
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">{opponentLabel}</p>
                            <p className="text-4xl font-black text-red-400">{engine.opponentScore}</p>
                        </div>
                    </div>
                )}

                {/* Match End */}
                {engine.phase === "matchEnd" && engine.matchResult && (
                    <div className="text-center space-y-6 py-6">
                        <div className="relative inline-block">
                            <div className={`text-8xl ${engine.matchResult === "won" ? "animate-bounce" : "animate-pulse"}`}>
                                {engine.matchResult === "won" ? "🏆" : "😔"}
                            </div>
                            {engine.matchResult === "won" && (
                                <div className="absolute -inset-8 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <h2 className={`text-3xl font-black ${engine.matchResult === "won" ? "text-emerald-400" : "text-red-400"}`}>
                                {engine.matchResult === "won" ? "You Won the Match!" : "You Lost the Match"}
                            </h2>
                            <p className="text-white/50 font-bold text-lg">{engine.playerScore} – {engine.opponentScore}</p>
                            <div className={`flex items-center gap-2 justify-center mt-2 px-4 py-2 rounded-full ${engine.matchResult === "won" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                <Star size={16} />
                                <span className="text-sm font-bold">
                                    {engine.matchResult === "won"
                                        ? `+${engine.stakeAmount * 2} Stars (escrow + winnings)`
                                        : `-${engine.stakeAmount} Stars (escrow lost)`
                                    }
                                </span>
                            </div>
                            {engine.aiActive && <p className="text-white/30 text-xs mt-1">🤖 AI was involved in this match</p>}
                        </div>

                        {/* Round History Summary */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-left">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-wider">Match Summary</p>
                            {engine.roundHistory.map((r, i) => (
                                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                                    <span className="text-[10px] font-mono text-white/20 w-6">R{r.round}</span>
                                    <span className="text-lg">{choiceEmoji(r.playerChoice)}</span>
                                    <span className="text-white/20 text-xs">vs</span>
                                    <span className="text-lg">{choiceEmoji(r.opponentChoice)}</span>
                                    <span className={`text-xs font-bold ml-auto uppercase ${resultColors[r.result]}`}>{r.result}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={engine.handlePlayAgain}
                            disabled={engine.isLoading}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-2xl"
                        >
                            {engine.isLoading ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                            Play Again
                        </button>
                    </div>
                )}

                {/* Countdown */}
                {engine.phase === "countdown" && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-6">
                        <div className="text-8xl font-black text-emerald-400 animate-pulse tabular-nums">
                            {engine.countdown > 0 ? engine.countdown : "GO!"}
                        </div>
                        <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Get ready...</p>
                    </div>
                )}

                {/* Reveal */}
                {engine.phase === "reveal" && (
                    <div className="flex flex-col items-center py-8 space-y-6">
                        <div className="flex items-center gap-8">
                            <div className="text-center space-y-2">
                                <div className="text-7xl animate-in zoom-in-50 duration-500">{choiceEmoji(engine.playerChoice)}</div>
                                <p className="text-xs font-bold text-white/40 uppercase">You</p>
                            </div>
                            <div className="text-white/20 font-black text-3xl">vs</div>
                            <div className="text-center space-y-2">
                                <div className="text-7xl animate-in zoom-in-50 duration-500 delay-200">{choiceEmoji(engine.opponentChoice)}</div>
                                <p className="text-xs font-bold text-white/40 uppercase">{opponentLabel}</p>
                            </div>
                        </div>
                        {engine.lastResult && (
                            <div className={`text-2xl font-black animate-in zoom-in-75 duration-300 ${resultColors[engine.lastResult]}`}>
                                {resultText[engine.lastResult]}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════
                    WAITING — Move Locked, waiting for opponent
                    Shows disconnect banner with "Switch to AI now" button
                    ═══════════════════════════════════════════════════════ */}
                {engine.phase === "waiting" && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-in fade-in duration-300">
                        <DisconnectBanner />

                        {engine.aiActive && (
                            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4 text-center space-y-2 w-full max-w-xs">
                                <p className="text-cyan-400 font-bold text-sm">🤖 AI is playing for your opponent</p>
                                <p className="text-white/50 text-xs">Your move is submitted. AI will respond now.</p>
                            </div>
                        )}
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <div className="text-5xl animate-bounce">{choiceEmoji(engine.playerChoice)}</div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center">
                                <span className="text-xs">🔒</span>
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-emerald-400">Move Locked 🔒</h3>
                            <p className="text-white/40 text-sm font-bold uppercase tracking-widest">
                                {engine.aiActive ? "AI is thinking…" : engine.mode === "solo" ? "Resolving..." : `${opponentLabel} is thinking…`}
                            </p>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════
                    CHOOSING — Make your move
                    Also shows disconnect banner if opponent dropped
                    ═══════════════════════════════════════════════════════ */}
                {engine.phase === "choosing" && !engine.matchResult && (
                    <div className="space-y-6 py-4">
                        <DisconnectBanner compact />

                        <div className="text-center space-y-1">
                            {engine.moveTimeLeft !== null && engine.moveTimeLeft > 0 && (
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 ${
                                    engine.moveTimeLeft <= 10 ? 'bg-red-500/10 text-red-400 animate-pulse' : 'bg-white/5 text-white/40'
                                }`}>
                                    ⏱ {engine.moveTimeLeft}s
                                </div>
                            )}
                            <p className="text-white/60 text-sm font-bold">Make your move!</p>
                            {engine.mode === "friend" && engine.opponentName && (
                                <div className="flex items-center justify-center gap-2">
                                    <p className="text-emerald-400/60 text-[10px] font-bold uppercase tracking-wider">
                                        Playing vs {opponentLabel}
                                    </p>
                                    {((engine.isPlayerA && engine.match?.move_b) || (!engine.isPlayerA && engine.match?.move_a)) && (
                                        <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                            ✅ Ready
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {CHOICES.map(choice => (
                                <button
                                    key={choice.id}
                                    onClick={() => engine.handleChoice(choice.id)}
                                    disabled={engine.isSubmitting}
                                    className="group flex flex-col items-center gap-2 p-6 bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all"
                                >
                                    <span className="text-5xl group-hover:scale-110 transition-transform">{choice.emoji}</span>
                                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">{choice.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Round History (during game) — only shows after reveal completes */}
                {engine.roundHistory.length > 0 && engine.phase !== "matchEnd" && engine.phase !== "countdown" && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-wider">History</p>
                        {engine.roundHistory.map((r, i) => (
                            <div key={i} className="flex items-center gap-3 py-1 border-b border-white/5 last:border-0">
                                <span className="text-[10px] font-mono text-white/20 w-6">R{r.round}</span>
                                <span className="text-base">{choiceEmoji(r.playerChoice)}</span>
                                <span className="text-white/20 text-[10px]">vs</span>
                                <span className="text-base">{choiceEmoji(r.opponentChoice)}</span>
                                <span className={`text-[10px] font-bold ml-auto uppercase ${resultColors[r.result]}`}>{r.result}</span>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
