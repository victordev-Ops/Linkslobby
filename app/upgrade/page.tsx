"use client"

import { useState, useTransition, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles, Check, Zap, Shield, Palette, Users, Star,
  ArrowLeft, Loader2, BadgeCheck, Eye, MessageCircle, 
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createPaystackCheckout } from "@/actions/subscription"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import VerifiedBadge from "@/components/VerifiedBadge"

type Plan = "weekly" | "monthly" | "annual"

const plans = [
  {
    id: "weekly" as Plan,
    name: "Weekly",
    price: "₦499",
    rawPrice: 499,
    period: "/week",
    badge: null,
    savings: null,
  },
  {
    id: "monthly" as Plan,
    name: "Monthly",
    price: "₦1,499",
    rawPrice: 1499,
    period: "/month",
    badge: "Most Popular",
    savings: "Save 30%",
  },
  {
    id: "annual" as Plan,
    name: "Annual",
    price: "₦6,999",
    rawPrice: 6999,
    period: "/year",
    badge: "Best Value",
    savings: "Save 73%",
  },
]

const benefits = [
  {
    icon: BadgeCheck,
    title: "Verified badge",
    desc: "Blue tick shown on your profile and messages",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Shield,
    title: "Priority support",
    desc: "24/7 dedicated customer support",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: Users,
    title: "5 Truth or Dare lobbies",
    desc: "3× more lobbies than the free plan",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Zap,
    title: "2× star earnings",
    desc: "Double XP on every activity you complete",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Eye,
    title: "Reveal message senders",
    desc: "See who sent you anonymous messages",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    icon: MessageCircle,
    title: "No watermark",
    desc: "Clean shares — no Say branding on exports",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Sparkles,
    title: "Exclusive themes",
    desc: "Unlock pro-only profile themes & customization",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    icon: Star,
    title: "Ad-free experience",
    desc: "No ads, ever — just the full Say experience",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
]

function UpgradeContent() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>("monthly")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile } = useAuth()

  const cancelled = searchParams.get("cancelled")

  const handleCheckout = () => {
    startTransition(async () => {
      try {
        const result = await createPaystackCheckout(selectedPlan)
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

  if (profile?.is_pro) {
    return (
      <div className="min-h-screen bg-[#0f0a1e] text-white flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20">
            <BadgeCheck size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black flex items-center justify-center gap-2">
            You&apos;re Verified! <VerifiedBadge size={28} />
          </h1>
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

  const selectedPlanData = plans.find(p => p.id === selectedPlan)!

  return (
    <div className="min-h-screen bg-[#0f0a1e] text-white relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-purple-900/25 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-5 pb-36">

        {/* Nav */}
        <div className="pt-6 pb-2 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition active:scale-95"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        {/* Cancelled banner */}
        {cancelled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-medium text-center"
          >
            Payment was cancelled. Choose a plan to try again.
          </motion.div>
        )}

        {/* Profile preview — the "what you'll look like" card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-2 mb-8 p-5 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-sm"
        >
          {/* label */}
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/30 mb-4">Your profile</p>

          <div className="flex items-center gap-3">
            {/* Avatar */}
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-400/40"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-lg ring-2 ring-blue-400/40">
                {profile?.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-white text-base leading-none">
                  {profile?.username || 'your_username'}
                </span>
                <VerifiedBadge size={18} />
              </div>
              <p className="text-white/40 text-xs mt-0.5">@{profile?.slug || 'username'}</p>
            </div>

            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/20">
              <Crown size={12} className="text-blue-400" />
              <span className="text-[11px] font-black text-blue-400">PRO</span>
            </div>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-black tracking-tight leading-tight mb-2">
            Upgrade to<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Say Pro</span>
          </h1>
          <p className="text-white/45 text-sm font-medium">Everything unlocked. Nothing held back.</p>
        </motion.div>

        {/* Plan selector */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/[0.07]">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative py-3 px-2 rounded-xl text-center transition-all duration-200 active:scale-95 ${
                  selectedPlan === plan.id
                    ? "bg-white text-black shadow-lg"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {plan.badge && (
                  <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap ${
                    plan.badge === "Best Value"
                      ? "bg-emerald-500 text-white"
                      : "bg-blue-500 text-white"
                  }`}>
                    {plan.badge}
                  </span>
                )}
                <div className={`text-xs font-black mb-0.5 ${selectedPlan === plan.id ? "text-black" : ""}`}>
                  {plan.name}
                </div>
                <div className={`text-[11px] font-bold ${selectedPlan === plan.id ? "text-black/60" : "text-white/30"}`}>
                  {plan.price}
                </div>
                {plan.savings && (
                  <div className={`text-[9px] font-black mt-0.5 ${
                    selectedPlan === plan.id ? "text-emerald-600" : "text-emerald-400/60"
                  }`}>
                    {plan.savings}
                  </div>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Benefits list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/30 mb-4 px-1">What you get</p>
          <div className="space-y-2">
            {benefits.map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.04 }}
                className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
              >
                <div className={`w-8 h-8 rounded-xl ${benefit.bg} flex items-center justify-center shrink-0`}>
                  <benefit.icon size={16} className={benefit.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white leading-none mb-0.5">{benefit.title}</p>
                  <p className="text-[11px] text-white/40 font-medium leading-tight">{benefit.desc}</p>
                </div>
                <Check size={14} className="text-emerald-400 shrink-0" />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Social proof / trust line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-6 text-center"
        >
          <p className="text-[11px] text-white/25 font-medium">
            Join thousands of verified Say users
          </p>
        </motion.div>

      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-5 pb-8 pt-4 bg-gradient-to-t from-[#0f0a1e] via-[#0f0a1e]/95 to-transparent">
        <div className="max-w-lg mx-auto space-y-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleCheckout}
            disabled={isPending}
            className="w-full py-4 bg-white text-black font-black text-base rounded-2xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:bg-white/90 active:scale-95"
          >
            {isPending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <VerifiedBadge size={20} />
                Get Verified — {selectedPlanData.price}{selectedPlanData.period}
              </>
            )}
          </motion.button>
          <p className="text-center text-[10px] text-white/25 font-medium">
            Cancel anytime · Secure payment via Paystack · Instant activation
          </p>
        </div>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-white/30" />
      </div>
    }>
      <UpgradeContent />
    </Suspense>
  )
}
