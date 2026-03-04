"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Crown, PartyPopper, ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import confetti from "canvas-confetti"

export default function UpgradeSuccessPage() {
    const { refreshProfile } = useAuth()
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        // Refresh the profile to pick up is_pro = true
        refreshProfile()

        // Fire confetti
        const duration = 2000
        const end = Date.now() + duration
        const colors = ["#f59e0b", "#eab308", "#fbbf24", "#a855f7", "#7c3aed"]

        const frame = () => {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.7 },
                colors,
            })
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.7 },
                colors,
            })
            if (Date.now() < end) requestAnimationFrame(frame)
        }
        frame()

        setLoaded(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="min-h-screen bg-[#0f0a1e] text-white flex items-center justify-center px-6 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[30%] left-[20%] w-[60vw] h-[60vw] bg-amber-900/30 rounded-full blur-[150px] animate-pulse" />
                <div className="absolute bottom-[20%] right-[10%] w-[40vw] h-[40vw] bg-purple-900/30 rounded-full blur-[100px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.4, delay: 0.2 }}
                className="relative z-10 text-center space-y-8 max-w-sm mx-auto"
            >
                {/* Success icon */}
                <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className="w-28 h-28 bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/40"
                >
                    <Crown size={56} className="text-white drop-shadow-lg" />
                </motion.div>

                {/* Title */}
                <div className="space-y-3">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex items-center justify-center gap-2 text-amber-400"
                    >
                        <PartyPopper size={20} />
                        <span className="text-sm font-black uppercase tracking-[0.2em]">Welcome to Pro</span>
                        <PartyPopper size={20} />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="text-4xl font-black tracking-tight"
                    >
                        You&apos;re all set! 🎉
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="text-white/50 font-medium leading-relaxed"
                    >
                        Your Pro subscription is now active. Enjoy all premium features — you&apos;ve earned it.
                    </motion.p>
                </div>

                {/* Pro features quick summary */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4"
                >
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-widest">
                        <Sparkles size={14} />
                        <span>Unlocked</span>
                    </div>
                    <div className="space-y-3 text-sm text-left">
                        {[
                            "5 TOD lobbies",
                            "2x XP multiplier",
                            "Watermark-free shares",
                            "Pro profile badge",
                            "Priority support",
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-400/20 flex items-center justify-center shrink-0">
                                    <span className="text-emerald-400 text-xs">✓</span>
                                </div>
                                <span className="text-white/70 font-medium">{item}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                >
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-lg rounded-2xl shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all active:scale-95"
                    >
                        Let&apos;s Go
                        <ArrowRight size={20} />
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    )
}
