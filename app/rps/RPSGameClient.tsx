"use client"

import { Loader2 } from "lucide-react"
import { Space_Grotesk, Inter } from "next/font/google"
import { useRPSEngine } from "./useRPSEngine"
import { RPSLobby } from "./components/RPSLobby"
import { RPSWaitingRoom } from "./components/RPSWaitingRoom"
import { RPSArena } from "./components/RPSArena"
import { RPSStakeSelector } from "./components/RPSStakeSelector"

// Same two-role type system as the dashboard/profile pages: Space Grotesk
// carries personality for headings, Inter stays quiet and legible for body
// copy. The variables are set once here and cascade to every RPS screen
// (Lobby, Waiting Room, Stake Selector, Arena) since font-family inherits.
const display = Space_Grotesk({
    subsets: ["latin"],
    weight: ["500", "600", "700"],
    variable: "--font-display",
})
const body = Inter({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
    variable: "--font-body",
})

interface RPSGameClientProps {
    profile: { id: string; username: string; slug: string; is_pro: boolean }
}

export default function RPSGameClient({ profile }: RPSGameClientProps) {
    const engine = useRPSEngine(profile)

    return (
        <div className={`${display.variable} ${body.variable} font-[family-name:var(--font-body)]`}>
            {/* ─── Loading state ─── */}
            {engine.isRecovering ? (
                <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <Loader2 size={40} className="text-emerald-400 animate-spin mx-auto" />
                        <p className="text-white/40 text-sm">Warming up the arena...</p>
                    </div>
                </div>
            ) : engine.showStakeSelector ? (
                /* ─── Stake Selector Modal ─── */
                <RPSStakeSelector engine={engine} />
            ) : !engine.mode ? (
                /* ─── Screens ─── */
                <RPSLobby engine={engine} />
            ) : engine.mode === "friend" && engine.match?.status === "waiting" ? (
                <RPSWaitingRoom engine={engine} />
            ) : (
                <RPSArena engine={engine} />
            )}
        </div>
    )
}
