"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Play } from "lucide-react"
import type { useRPSEngine } from "../hooks/useRPSEngine"

const MIN_STAKE = 50
const MAX_STAKE = 10000

export function RPSStakeSelector({ engine }: { engine: ReturnType<typeof useRPSEngine> }) {
    const [localStake, setLocalStake] = useState(engine.stakeAmount)

    const handleIncrement = () => {
        setLocalStake(prev => Math.min(prev + 50, Math.min(MAX_STAKE, engine.starBalance || MAX_STAKE)))
    }

    const handleDecrement = () => {
        setLocalStake(prev => Math.max(prev - 50, MIN_STAKE))
    }

    const handleConfirm = () => {
        engine.handleStakeConfirm(localStake)
    }

    const canAfford = localStake <= (engine.starBalance || 0)

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-8 max-w-sm w-full space-y-6">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-white">Select Stake</h2>
                    <p className="text-white/50 text-sm">How many Stars do you want to wager?</p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-white/60">Your Balance:</span>
                        <span className="text-amber-400 font-bold">{engine.starBalance} ⭐</span>
                    </div>
                    
                    <div className="bg-white/5 rounded-xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={handleDecrement}
                                disabled={localStake <= MIN_STAKE}
                                className="p-2 hover:bg-white/10 disabled:opacity-40 rounded-lg transition"
                            >
                                <ChevronDown size={20} className="text-white/60" />
                            </button>
                            <div className="text-center">
                                <div className="text-4xl font-black text-amber-400">{localStake}</div>
                                <div className="text-white/40 text-xs mt-1">Stars</div>
                            </div>
                            <button
                                onClick={handleIncrement}
                                disabled={localStake >= Math.min(MAX_STAKE, engine.starBalance || MAX_STAKE)}
                                className="p-2 hover:bg-white/10 disabled:opacity-40 rounded-lg transition"
                            >
                                <ChevronUp size={20} className="text-white/60" />
                            </button>
                        </div>

                        {!canAfford && (
                            <div className="text-red-400 text-xs text-center">
                                Insufficient balance
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-white/40 text-center">
                        Min: {MIN_STAKE} ⭐ — Max: {Math.min(MAX_STAKE, engine.starBalance || 0)} ⭐
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => engine.setShowStakeSelector(false)}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canAfford || engine.isLoading}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
                    >
                        <Play size={16} />
                        Play
                    </button>
                </div>
            </div>
        </div>
    )
}
