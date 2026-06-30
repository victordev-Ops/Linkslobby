"use client"

import { Loader2 } from "lucide-react"
import { useRPSEngine } from "./hooks/useRPSEngine"
import { RPSLobby } from "./components/RPSLobby"
import { RPSWaitingRoom } from "./components/RPSWaitingRoom"
import { RPSArena } from "./components/RPSArena"
import { RPSStakeSelector } from "./components/RPSStakeSelector"

interface RPSGameClientProps {
    profile: { id: string; username: string; slug: string; is_pro: boolean }
}

export default function RPSGameClient({ profile }: RPSGameClientProps) {
    const engine = useRPSEngine(profile)

    // ─── Loading state ───
    if (engine.isRecovering) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 size={40} className="text-emerald-400 animate-spin mx-auto" />
                    <p className="text-white/40 text-sm">Loading game...</p>
                </div>
            </div>
        )
    }

    // ─── Stake Selector Modal ───
    if (engine.showStakeSelector) {
        return <RPSStakeSelector engine={engine} />
    }

    // ─── Screens ───
    if (!engine.mode) {
        return <RPSLobby engine={engine} />
    }

    if (engine.mode === "friend" && engine.match?.status === "waiting") {
        return <RPSWaitingRoom engine={engine} />
    }

    return <RPSArena engine={engine} />
}
