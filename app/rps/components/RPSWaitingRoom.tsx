"use client"

import { useState } from "react"
import { ArrowLeft, Loader2, Share2, Monitor, Swords, Check, Copy } from "lucide-react"
import type { useRPSEngine } from "../useRPSEngine"

export function RPSWaitingRoom({ engine }: { engine: ReturnType<typeof useRPSEngine> }) {
    const [copied, setCopied] = useState(false)

    const handleCopyCode = async () => {
        if (!engine.roomCode) return
        try {
            await navigator.clipboard.writeText(engine.roomCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
        } catch {
            // clipboard unavailable — silently ignore, Share button still works
        }
    }

    return (
        <div className="min-h-[100dvh] bg-[#0a0a0f] text-white relative overflow-hidden flex flex-col">
            {/* Ambient background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] bg-emerald-600/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-teal-600/10 blur-[100px] rounded-full" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 px-3 py-2.5 flex items-center gap-2">
                <button
                    onClick={engine.handleBack}
                    aria-label="Go back"
                    className="p-2 -ml-1 rounded-full text-white/60 hover:text-white hover:bg-white/5 active:bg-white/10 transition"
                >
                    <ArrowLeft size={20} />
                </button>
                <Swords size={16} className="text-emerald-500 shrink-0" />
                <div className="min-w-0">
                    <h1 className="font-bold text-sm leading-tight truncate">Waiting for friend</h1>
                </div>
                <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="relative flex w-1.5 h-1.5">
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
                        <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-300">Live</span>
                </div>
            </header>

            {/* Content */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-8 gap-7 max-w-md w-full mx-auto">
                {/* Searching indicator */}
                <div className="relative flex items-center justify-center w-20 h-20">
                    <span className="absolute inset-0 rounded-full border border-emerald-500/30 animate-[ping_2.5s_ease-out_infinite]" />
                    <span className="absolute inset-[-10px] rounded-full border border-emerald-500/15 animate-[ping_2.5s_ease-out_infinite_0.6s]" />
                    <div className="relative w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                        <Loader2 size={28} className="text-emerald-400 animate-spin" />
                    </div>
                </div>

                <div className="text-center space-y-1.5">
                    <h2 className="text-xl font-black tracking-tight">Share this code</h2>
                    <p className="text-sm text-white/40 max-w-[26ch] mx-auto">
                        Send it to a friend, or tap the code below to copy it
                    </p>
                </div>

                {/* Room code — tap to copy */}
                <button
                    onClick={handleCopyCode}
                    aria-label={copied ? "Code copied" : "Tap to copy room code"}
                    className="group w-full bg-white/5 hover:bg-white/[0.07] border border-emerald-500/30 rounded-2xl px-5 py-5 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                >
                    <div className="flex items-center justify-center gap-3">
                        <p className="text-3xl sm:text-4xl font-black font-mono tracking-[0.35em] text-emerald-400">
                            {engine.roomCode}
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] font-semibold uppercase tracking-wider text-white/30 group-hover:text-white/50 transition">
                        {copied ? (
                            <>
                                <Check size={12} className="text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                            </>
                        ) : (
                            <>
                                <Copy size={12} />
                                <span>Tap to copy</span>
                            </>
                        )}
                    </div>
                </button>

                {/* Primary action */}
                <button
                    onClick={engine.handleShareRoom}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl transition active:scale-[0.98] shadow-lg shadow-emerald-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
                >
                    <Share2 size={18} />
                    Share invite link
                </button>

                {/* Secondary path */}
                <div className="w-full space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/5" />
                        <span className="text-white/30 text-[11px] uppercase tracking-wider font-bold">or</span>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>

                    <button
                        onClick={engine.switchToAI}
                        disabled={engine.isLoading}
                        className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
                    >
                        {engine.isLoading ? <Loader2 size={18} className="animate-spin" /> : <Monitor size={18} />}
                        Play vs AI instead
                    </button>

                    <button
                        onClick={engine.handleBack}
                        className="w-full py-3 text-white/40 hover:text-white/70 active:text-white/80 font-bold text-sm transition"
                    >
                        Cancel match
                    </button>
                </div>
            </main>

            {/* Safe-area spacer for iOS home indicator */}
            <div className="pb-[env(safe-area-inset-bottom)]" />
        </div>
    )
                        }

                                
