"use client"
import { useEffect, useRef, useState } from "react"

/**
 * Native emoji hands (👊 ✋ ✌️) instead of drawn/rigged geometry — these
 * already read as real human hands at a glance. Animation crossfades opacity
 * + scale between the three emoji while the whole hand punches toward
 * center, peaking mid-transition.
 */

type Gesture = "rock" | "paper" | "scissors"
const ORDER: Gesture[] = ["rock", "paper", "scissors"]
const EMOJI: Record<Gesture, string> = { rock: "👊", paper: "✋", scissors: "✌️" }

function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function RPSHandEmoji({
    side,
    animate,
    cycleDuration = 3,
}: {
    side: "left" | "right"
    animate: boolean
    cycleDuration?: number
}) {
    const [opacity, setOpacity] = useState<Record<Gesture, number>>({ rock: 1, paper: 0, scissors: 0 })
    const [wrapperTransform, setWrapperTransform] = useState("translateX(0px) rotate(0deg) scale(1)")
    const rafRef = useRef<number>(0)
    const startRef = useRef<number>(0)

    useEffect(() => {
        if (!animate) {
            setOpacity({ rock: 1, paper: 0, scissors: 0 })
            setWrapperTransform("translateX(0px) rotate(0deg) scale(1)")
            return
        }
        const dir = side === "left" ? 1 : -1
        startRef.current = 0

        const tick = (now: number) => {
            if (!startRef.current) startRef.current = now
            const elapsed = (now - startRef.current) / 1000
            const t = elapsed % cycleDuration
            const segDur = cycleDuration / ORDER.length
            const segIndex = Math.floor(t / segDur)
            const localT = (t % segDur) / segDur
            const eased = easeInOutCubic(localT)
            const cur = ORDER[segIndex]
            const next = ORDER[(segIndex + 1) % ORDER.length]

            const nextOpacity: Record<Gesture, number> = { rock: 0, paper: 0, scissors: 0 }
            nextOpacity[cur] = 1 - eased
            nextOpacity[next] = eased
            setOpacity(nextOpacity)

            // punch toward center + slight lean + pop, peaking mid-transition
            const punch = Math.sin(eased * Math.PI) * 14
            const lean = Math.sin(eased * Math.PI) * 6 * dir
            const pop = 1 + Math.sin(eased * Math.PI) * 0.12
            setWrapperTransform(`translateX(${punch * dir}px) rotate(${lean}deg) scale(${pop})`)

            rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafRef.current)
    }, [animate, cycleDuration, side])

    const mirror = side === "right"

    return (
        <div
            className="absolute top-0 bottom-0 flex items-center justify-center"
            style={{
                left: side === "left" ? "4%" : undefined,
                right: side === "right" ? "4%" : undefined,
                width: "46%",
                transform: wrapperTransform,
                willChange: "transform",
            }}
        >
            <div
                className="relative w-full aspect-square"
                style={{ transform: mirror ? "scaleX(-1)" : undefined }}
            >
                {ORDER.map((g) => (
                    <span
                        key={g}
                        className="absolute inset-0 flex items-center justify-center leading-none select-none"
                        style={{
                            fontSize: "clamp(56px, 22vw, 96px)",
                            opacity: opacity[g],
                            transform: `scale(${0.88 + opacity[g] * 0.12})`,
                            filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.35))",
                        }}
                    >
                        {EMOJI[g]}
                    </span>
                ))}
            </div>
        </div>
    )
}
