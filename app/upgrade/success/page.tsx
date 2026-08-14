"use client"

import { useEffect, useState, Suspense } from "react"
import { motion } from "framer-motion"
import { Loader2, BadgeCheck, XCircle } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { confirmPaystackPayment } from "@/actions/subscription"
import { useAuth } from "@/context/AuthContext"
import VerifiedBadge from "@/components/VerifiedBadge"

type ConfirmState = "checking" | "success" | "error"

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { profile, refreshProfile } = useAuth()

  const reference = searchParams.get("reference")
  const [state, setState] = useState<ConfirmState>("checking")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    // Already pro (e.g. webhook beat us here, or user navigated back to
    // this page after already being confirmed) — nothing left to do.
    if (profile?.is_pro) {
      setState("success")
      return
    }

    if (!reference) {
      setState("error")
      setErrorMessage("Missing payment reference.")
      return
    }

    let cancelled = false

    async function confirm() {
      const result = await confirmPaystackPayment(reference!)

      if (cancelled) return

      if (result.success && result.isPro) {
        await refreshProfile?.()
        setState("success")
      } else if (result.success && !result.isPro) {
        // Verified but is_pro still false — most likely a one-off charge
        // with no subscription attached. Surface it rather than pretending.
        setState("error")
        setErrorMessage("Payment verified, but no active subscription was found. Contact support if this looks wrong.")
      } else {
        setState("error")
        setErrorMessage(result.error || "Could not confirm your payment.")
      }
    }

    confirm()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, profile?.is_pro])

  return (
    <div className="min-h-screen bg-[#0f0a1e] text-white flex items-center justify-center px-6">
      {state === "checking" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <Loader2 size={40} className="animate-spin text-blue-400 mx-auto" />
          <h1 className="text-2xl font-black">Confirming your payment…</h1>
          <p className="text-white/50 text-sm">This only takes a moment.</p>
        </motion.div>
      )}

      {state === "success" && (
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
      )}

      {state === "error" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 max-w-sm"
        >
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
            <XCircle size={36} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-black">We couldn&apos;t confirm that</h1>
          <p className="text-white/50 text-sm">{errorMessage}</p>
          <p className="text-white/30 text-xs">
            If money left your account, your subscription may still be activating in the background — check Settings in a minute before retrying.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => router.push("/upgrade")}
              className="px-6 py-3 bg-white text-black rounded-2xl font-bold text-sm hover:bg-white/90 transition"
            >
              Try again
            </button>
            <Link
              href="/settings"
              className="px-6 py-3 bg-white/10 rounded-2xl font-bold text-sm border border-white/10 hover:bg-white/20 transition"
            >
              Check Settings
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default function UpgradeSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-white/30" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
