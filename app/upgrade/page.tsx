"use client"

import { useState, useTransition, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Crown, Sparkles, Check, Zap, Shield, Palette, Users, Star, ArrowLeft, CreditCard, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createStripeCheckout, createPaystackCheckout } from "@/actions/subscription"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"

type Plan = "weekly" | "monthly" | "annual"
type Provider = "stripe" | "paystack"

const plans = [
    {
        id: "weekly" as Plan,
        name: "Weekly",
        price: "$1.99",
        period: "/week",
        badge: null,
        savings: null,
    },
    {
        id: "monthly" as Plan,
        name: "Monthly",
        price: "$5.99",
        period: "/month",
        badge: "Popular",
        savings: "Save 25%",
    },
    {
        id: "annual" as Plan,
        name: "Annual",
        price: "$49.99",
        period: "/year",
        badge: "Best Value",
        savings: "Save 52%",
    },
]

const benefits = [
    { icon: Users, text: "5 TOD lobbies (vs 3 for free)", color: "text-purple-400" },
    { icon: Zap, text: "2x XP on all activities", color: "text-yellow-400" },
    { icon: Palette, text: "Remove watermark from shares", color: "text-pink-400" },
    { icon: Shield, text: "Priority support", color: "text-blue-400" },
    { icon: Star, text: "Pro badge on your profile", color: "text-amber-400" },
    { icon: Sparkles, text: "Exclusive themes & customization", color: "text-emerald-400" },
]

function UpgradeContent() {
    const [selectedPlan, setSelectedPlan] = useState<Plan>("monthly")
    const [selectedProvider, setSelectedProvider] = useState<Provider>("stripe")
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { profile } = useAuth()

    const cancelled = searchParams.get("cancelled")

    const handleCheckout = () => {
        startTransition(async () => {
            try {
                const result = selectedProvider === "stripe"
                    ? await createStripeCheckout(selectedPlan)
                    : await createPaystackCheckout(selectedPlan)

                if (result.success && result.url) {
                    window.location.href = result.url
                } else {
                    toast.error(result.error || "Failed to start checkout")
                }
            } catch {
                toast.error("Something went wrong. Please try again.")
            }
        })
    }

    // If already pro, show a message
    if (profile?.is_pro) {
        return (
            <div className="min-h-screen bg-[#0f0a1e] text-white flex items-center justify-center px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4"
                >
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20">
                        <Crown size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-black">You&apos;re already Pro! 👑</h1>
                    <p className="text-white/50">Manage your subscription in Settings.</p>
                    <Link
                        href="/settings"
                        className="inline-block px-8 py-3 bg-white/10 rounded-2xl font-bold border border-white/10 hover:bg-white/20 transition"
                    >
                        Go to Settings
                    </Link>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0f0a1e] text-white relative overflow-hidden">
            {/* Background gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] bg-amber-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-purple-900/30 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 max-w-lg mx-auto px-6 pb-32">
                {/* Header */}
                <div className="pt-6 pb-4 flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-lg font-black tracking-tight">Upgrade to Pro</h1>
                </div>

                {cancelled && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-medium text-center"
                    >
                        Payment was cancelled. Choose a plan to try again.
                    </motion.div>
                )}

                {/* Hero */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-8"
                >
                    <motion.div
                        animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        className="w-24 h-24 bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-500/30"
                    >
                        <Crown size={48} className="text-white drop-shadow-lg" />
                    </motion.div>
                    <h2 className="text-4xl font-black tracking-tight mb-2">
                        Go <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">Pro</span> ✨
                    </h2>
                    <p className="text-white/50 font-medium">
                        Unlock the full experience
                    </p>
                </motion.div>

                {/* Benefits */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mb-10 space-y-3"
                >
                    {benefits.map((benefit, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.05 }}
                            className="flex items-center gap-4 p-3 bg-white/[0.03] rounded-2xl border border-white/5"
                        >
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                                <benefit.icon size={20} className={benefit.color} />
                            </div>
                            <span className="text-sm font-semibold text-white/80">{benefit.text}</span>
                            <Check size={16} className="ml-auto text-emerald-400 shrink-0" />
                        </motion.div>
                    ))}
                </motion.div>

                {/* Plan selection */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mb-8"
                >
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-4 px-1">Choose your plan</h3>
                    <div className="space-y-3">
                        {plans.map((plan) => (
                            <button
                                key={plan.id}
                                onClick={() => setSelectedPlan(plan.id)}
                                className={`w-full p-4 rounded-2xl border-2 transition-all duration-200 text-left flex items-center gap-4 ${selectedPlan === plan.id
                                    ? "border-amber-400/60 bg-amber-400/10 shadow-lg shadow-amber-500/10"
                                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                                    }`}
                            >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selectedPlan === plan.id
                                    ? "border-amber-400 bg-amber-400"
                                    : "border-white/30"
                                    }`}>
                                    {selectedPlan === plan.id && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 bg-black rounded-full" />
                                    )}
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white">{plan.name}</span>
                                        {plan.badge && (
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${plan.badge === "Best Value"
                                                ? "bg-emerald-400/20 text-emerald-400"
                                                : "bg-amber-400/20 text-amber-400"
                                                }`}>
                                                {plan.badge}
                                            </span>
                                        )}
                                    </div>
                                    {plan.savings && (
                                        <span className="text-xs text-emerald-400 font-medium">{plan.savings}</span>
                                    )}
                                </div>

                                <div className="text-right">
                                    <span className="text-xl font-black text-white">{plan.price}</span>
                                    <span className="text-white/40 text-sm">{plan.period}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Payment provider selection */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mb-8"
                >
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-4 px-1">Payment method</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setSelectedProvider("stripe")}
                            className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${selectedProvider === "stripe"
                                ? "border-indigo-400/60 bg-indigo-400/10"
                                : "border-white/10 bg-white/[0.02] hover:border-white/20"
                                }`}
                        >
                            <CreditCard size={24} className={selectedProvider === "stripe" ? "text-indigo-400" : "text-white/50"} />
                            <span className="text-sm font-bold">Stripe</span>
                            <span className="text-[10px] text-white/40">Cards & more</span>
                        </button>
                        <button
                            onClick={() => setSelectedProvider("paystack")}
                            className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${selectedProvider === "paystack"
                                ? "border-emerald-400/60 bg-emerald-400/10"
                                : "border-white/10 bg-white/[0.02] hover:border-white/20"
                                }`}
                        >
                            <Shield size={24} className={selectedProvider === "paystack" ? "text-emerald-400" : "text-white/50"} />
                            <span className="text-sm font-bold">Paystack</span>
                            <span className="text-[10px] text-white/40">Africa-friendly</span>
                        </button>
                    </div>
                </motion.div>

                {/* Checkout button */}
                <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-[#0f0a1e] via-[#0f0a1e] to-transparent">
                    <div className="max-w-lg mx-auto">
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleCheckout}
                            disabled={isPending}
                            className="w-full py-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-lg rounded-2xl shadow-xl shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-amber-500/30"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={20} />
                                    Upgrade Now — {plans.find(p => p.id === selectedPlan)?.price}{plans.find(p => p.id === selectedPlan)?.period}
                                </>
                            )}
                        </motion.button>
                        <p className="text-center text-[10px] text-white/30 mt-3 font-medium">
                            Cancel anytime · Secure payment · Instant activation
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function UpgradePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center">
                <Loader2 size={40} className="animate-spin text-amber-500" />
            </div>
        }>
            <UpgradeContent />
        </Suspense>
    )
}
