//src/components/PushToggle.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Bell, BellOff, BellRing, Loader2, AlertCircle, ShieldOff } from "lucide-react"
import { usePushSubscription } from "@/hooks/use-push"

type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export default function PushToggle({
  userId,
  initialPushEnabled = false
}: {
  userId: string,
  initialPushEnabled?: boolean
}) {
  const { subscribe, unsubscribe, syncSubscription } = usePushSubscription()

  // Determine initial state synchronously — no loading flash when we already know
  const getInitialPermission = (): PermissionState => {
    if (typeof window === 'undefined') return 'default'
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
    return Notification.permission as PermissionState
  }

  const [permission, setPermission] = useState<PermissionState>(getInitialPermission)
  const [isEnabled, setIsEnabled] = useState(
    initialPushEnabled && getInitialPermission() === 'granted'
  )
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const perm = getInitialPermission()
    setPermission(perm)

    if (perm === 'granted') {
      // If server says enabled and browser agrees — we're done, no DB query needed
      if (initialPushEnabled) {
        setIsEnabled(true)
        // Background sync to keep subscription fresh
        syncSubscription(userId).catch(console.error)
        return
      }
      // Permission granted but server says not enabled — sync subscription
      syncSubscription(userId).catch(console.error)
      setIsEnabled(false)
    } else {
      setIsEnabled(false)
    }

    return () => { mountedRef.current = false }
  }, [userId, initialPushEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = async () => {
    if (loading || permission === 'denied' || permission === 'unsupported') return
    setLoading(true)

    try {
      if (isEnabled) {
        const success = await unsubscribe(userId)
        if (success && mountedRef.current) setIsEnabled(false)
      } else {
        const success = await subscribe(userId)
        if (success && mountedRef.current) {
          setIsEnabled(true)
          setPermission('granted')
        } else if (mountedRef.current) {
          // User may have denied during the prompt
          setPermission(Notification.permission as PermissionState)
        }
      }
    } catch (error) {
      console.error("Toggle error:", error)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  if (permission === 'unsupported') {
    return (
      <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-200 dark:border-yellow-500/20">
        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-yellow-900 dark:text-yellow-300">Not supported</p>
          <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-0.5">Use Chrome on Android or Safari on iOS 16.4+</p>
        </div>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-500/20">
        <ShieldOff className="h-5 w-5 text-red-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-900 dark:text-red-300">Blocked in browser</p>
          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
            Go to your browser settings → Site permissions → Notifications → Allow
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl transition-colors ${isEnabled ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'}`}>
          {isEnabled ? <BellRing size={20} /> : <BellOff size={20} />}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">Push Notifications</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isEnabled ? 'You\'ll be notified of new messages' : 'Tap to get instant alerts'}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading}
        className="relative h-7 w-12 cursor-pointer outline-none disabled:cursor-not-allowed flex-shrink-0"
        aria-label="Toggle push notifications"
      >
        <div className={`h-full w-full rounded-full transition-colors duration-300 ${isEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-white/20'} ${loading ? 'opacity-60' : ''}`} />
        <motion.div
          className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md"
          animate={{ x: isEnabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {loading && <Loader2 size={12} className="animate-spin text-gray-500" />}
        </motion.div>
      </button>
    </div>
  )
}
