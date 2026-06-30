"use client"
import { useEffect, useRef, useState } from "react"

/**
 * Flat-illustration human hand (SVG). Instead of rotating 3D joint capsules
 * (which read as a rigged robot hand), this renders three hand-drawn poses
 * — fist, open palm, scissors — sharing one palm/cuff base, and crossfades
 * between them. Skin-tone gradients, knuckle creases, and fingernail
 * highlights give it an organic, human read at small size.
 */

type Gesture = "rock" | "paper" | "scissors"
const ORDER: Gesture[] = ["rock", "paper", "scissors"]

function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function RPSHand2D({
    side,
    cuffColor,
    skinTone = "#e3ab7c",
    skinShadow = "#c4875a",
    skinHighlight = "#f2c79a",
    animate,
    cycleDuration = 3,
}: {
    side: "left" | "right"
    cuffColor: string
    skinTone?: string
    skinShadow?: string
    skinHighlight?: string
    animate: boolean
    cycleDuration?: number
}) {
    const [opacity, setOpacity] = useState<Record<Gesture, number>>({ rock: 1, paper: 0, scissors: 0 })
    const [transform, setTransform] = useState("translateX(0px) rotate(0deg) scale(1)")
    const rafRef = useRef<number>(0)
    const startRef = useRef<number>(0)

    useEffect(() => {
        if (!animate) {
            setOpacity({ rock: 1, paper: 0, scissors: 0 })
            setTransform("translateX(0px) rotate(0deg) scale(1)")
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
            const punch = Math.sin(eased * Math.PI) * 10
            const lean = Math.sin(eased * Math.PI) * 5 * dir
            const pop = 1 + Math.sin(eased * Math.PI) * 0.035
            setTransform(`translateX(${punch * dir}px) rotate(${lean}deg) scale(${pop})`)

            rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafRef.current)
    }, [animate, cycleDuration, side])

    const mirror = side === "right"
    const gradId = `skin-${side}`
    const nailId = `nail-${side}`

    return (
        <div
            className="absolute top-0 bottom-0"
            style={{
                left: side === "left" ? "6%" : undefined,
                right: side === "right" ? "6%" : undefined,
                width: "46%",
                transform,
                willChange: "transform",
            }}
        >
            <svg
                viewBox="0 0 200 260"
                className="w-full h-full"
                style={{ transform: mirror ? "scaleX(-1)" : undefined, filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.35))" }}
            >
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={skinHighlight} />
                        <stop offset="55%" stopColor={skinTone} />
                        <stop offset="100%" stopColor={skinShadow} />
                    </linearGradient>
                    <linearGradient id={nailId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* cuff */}
                <rect x="68" y="206" width="64" height="56" rx="14" fill={cuffColor} />
                <rect x="68" y="206" width="64" height="12" rx="6" fill="#000" opacity="0.12" />

                {/* palm / back of hand (shared base, never crossfades) */}
                <rect x="55" y="118" width="95" height="112" rx="32" fill={`url(#${gradId})`} />
                <path d="M70,150 Q100,160 132,150" stroke={skinShadow} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.35" />
                <ellipse cx="83" cy="134" rx="22" ry="12" fill={skinHighlight} opacity="0.3" />

                {/* ROCK */}
                <g style={{ opacity: opacity.rock }}>
                    {[69, 90, 112, 133].map((cx) => (
                        <circle key={cx} cx={cx} cy="113" r="12" fill={`url(#${gradId})`} stroke={skinShadow} strokeOpacity="0.25" />
                    ))}
                    <rect x="38" y="138" width="44" height="26" rx="13" fill={`url(#${gradId})`} stroke={skinShadow} strokeOpacity="0.2" transform="rotate(18 60 151)" />
                </g>

                {/* PAPER */}
                <g style={{ opacity: opacity.paper }}>
                    <FingerShape x={60} width={18} top={78} bottom={120} gradId={gradId} nailId={nailId} skinShadow={skinShadow} />
                    <FingerShape x={80} width={20} top={54} bottom={120} gradId={gradId} nailId={nailId} skinShadow={skinShadow} />
                    <FingerShape x={102} width={20} top={42} bottom={120} gradId={gradId} nailId={nailId} skinShadow={skinShadow} />
                    <FingerShape x={124} width={18} top={58} bottom={120} gradId={gradId} nailId={nailId} skinShadow={skinShadow} />
                    <rect x="47" y="145" width="22" height="55" rx="11" fill={`url(#${gradId})`} transform="rotate(-62 58 145)" />
                </g>

                {/* SCISSORS */}
                <g style={{ opacity: opacity.scissors }}>
                    {[69, 90].map((cx) => (
                        <circle key={cx} cx={cx} cy="113" r="12" fill={`url(#${gradId})`} stroke={skinShadow} strokeOpacity="0.25" />
                    ))}
                    <g transform="rotate(6 112 120)">
                        <FingerShape x={102} width={20} top={42} bottom={120} gradId={gradId} nailId={nailId} skinShadow={skinShadow} />
                    </g>
                    <g transform="rotate(-9 133 120)">
                        <FingerShape x={124} width={18} top={58} bottom={120} gradId={gradId} nailId={nailId} skinShadow={skinShadow} />
                    </g>
                    <rect x="40" y="140" width="42" height="25" rx="12" fill={`url(#${gradId})`} transform="rotate(26 60 151)" />
                </g>
            </svg>
        </div>
    )
}

function FingerShape({
    x, width, top, bottom, gradId, nailId, skinShadow,
}: { x: number; width: number; top: number; bottom: number; gradId: string; nailId: string; skinShadow: string }) {
    const height = bottom - top
    const rx = width / 2
    return (
        <g>
            <rect x={x} y={top} width={width} height={height} rx={rx} fill={`url(#${gradId})`} />
            <line x1={x + 2} y1={top + height * 0.38} x2={x + width - 2} y2={top + height * 0.38} stroke={skinShadow} strokeWidth="1.4" opacity="0.3" strokeLinecap="round" />
            <line x1={x + 2} y1={top + height * 0.66} x2={x + width - 2} y2={top + height * 0.66} stroke={skinShadow} strokeWidth="1.4" opacity="0.3" strokeLinecap="round" />
            <rect x={x + width * 0.18} y={top + 3} width={width * 0.64} height={height * 0.16} rx={width * 0.3} fill={`url(#${nailId})`} />
        </g>
    )
}
