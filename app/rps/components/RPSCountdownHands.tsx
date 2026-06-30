"use client"
import { useEffect, useState } from "react"

/**
 * Replaces the bare "3, 2, 1, GO!" numeral with two emoji fists that bump
 * toward each other on every tick, cycling rock → paper → scissors in time
 * with the countdown, landing on a flash + "GO!" impact. Driven by the
 * engine's own countdown value (not an independent timer) so it always
 * stays in sync with actual round timing.
 */

type Gesture = "rock" | "paper" | "scissors"
const EMOJI: Record<Gesture, string> = { rock: "👊", paper: "✋", scissors: "✌️" }
const LABEL: Record<Gesture, string> = { rock: "Rock!", paper: "Paper!", scissors: "Scissors!" }

function gestureForCount(count: number): Gesture {
    if (count >= 3) return "rock"
    if (count === 2) return "paper"
    return "scissors"
}

export function RPSCountdownHands({ countdown }: { countdown: number }) {
    const isGo = countdown <= 0
    const gesture = gestureForCount(countdown)
    const [punch, setPunch] = useState(false)

    useEffect(() => {
        setPunch(true)
        const t = window.setTimeout(() => setPunch(false), 220)
        return () => window.clearTimeout(t)
    }, [countdown])

    return (
        <div className="flex flex-col items-center justify-center py-12 space-y-5">
            <div className="relative w-full max-w-[260px] h-28 mx-auto">
                {isGo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-28 h-28 rounded-full bg-emerald-400/30 blur-2xl animate-ping" />
                    </div>
                )}

                {/* left fist */}
                <div
                    className="absolute top-0 bottom-0 left-[6%] w-[40%] flex items-center justify-center transition-transform duration-200 ease-out"
                    style={{ transform: `translateX(${punch ? (isGo ? 26 : 14) : 0}px) scale(${punch ? 1.08 : 1})` }}
                >
                    <span
                        key={`l-${gesture}-${countdown}`}
                        className="text-7xl leading-none select-none animate-in zoom-in-50 fade-in duration-200"
                        style={{ filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.35))" }}
                    >
                        {EMOJI[gesture]}
                    </span>
                </div>

                {/* right fist, mirrored */}
                <div
                    className="absolute top-0 bottom-0 right-[6%] w-[40%] flex items-center justify-center transition-transform duration-200 ease-out"
                    style={{ transform: `translateX(${punch ? (isGo ? -26 : -14) : 0}px) scale(${punch ? 1.08 : 1})` }}
                >
                    <span
                        key={`r-${gesture}-${countdown}`}
                        className="text-7xl leading-none select-none animate-in zoom-in-50 fade-in duration-200"
                        style={{ transform: "scaleX(-1)", filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.35))" }}
                    >
                        {EMOJI[gesture]}
                    </span>
                </div>
            </div>

            <p className={`text-2xl font-black uppercase tracking-widest ${isGo ? "text-emerald-400 animate-bounce" : "text-white/70"}`}>
                {isGo ? "GO!" : LABEL[gesture]}
            </p>
        </div>
    )
}
