"use client"
import { RPSHandEmoji } from "./RPSHandEmoji"

/**
 * Two emoji hands facing off, crossfading rock → paper → scissors.
 */
export function RPSHandsSceneEmoji({ reduceMotion }: { reduceMotion: boolean }) {
    return (
        <div className="relative w-full h-full overflow-hidden">
            <div className="absolute inset-x-[20%] top-[18%] bottom-[18%] rounded-full bg-emerald-400/10 blur-2xl" />
            <RPSHandEmoji side="left" animate={!reduceMotion} />
            <RPSHandEmoji side="right" animate={!reduceMotion} />
        </div>
    )
}

export default RPSHandsSceneEmoji
