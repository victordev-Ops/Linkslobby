"use client"
import { RPSHand2D } from "./RPSHand2D"

/**
 * Two flat-illustration hands facing off, cycling rock → paper → scissors.
 * Pure SVG/CSS — no WebGL/three.js, so it's lighter and SSR-safe (no need
 * for a client-only dynamic import with a loading skeleton).
 */
export function RPSHandsScene2D({ reduceMotion }: { reduceMotion: boolean }) {
    return (
        <div className="relative w-full h-full overflow-hidden">
            <div className="absolute inset-x-[20%] top-[22%] bottom-[16%] rounded-full bg-emerald-400/10 blur-2xl" />
            <RPSHand2D side="left" cuffColor="#34d399" animate={!reduceMotion} />
            <RPSHand2D side="right" cuffColor="#5eead4" animate={!reduceMotion} />
        </div>
    )
}

export default RPSHandsScene2D
