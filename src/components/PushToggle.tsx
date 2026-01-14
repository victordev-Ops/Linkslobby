"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Bell, BellOff, Loader2, AlertCircle } from "lucide-react"
import { usePushSubscription } from "@/hooks/use-push"
import { createClient } from "@/lib/supabase/client"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export default function PushToggle({ userId }: { userId: string }) {
  const { subscribe, unsubscribe } = usePushSubscription()
  const [isEnabled, setIsEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSupported, setIsSupported] = useState(true)
  
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    
    const checkStatus = async () => {
      try {
        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
          if (mountedRef.current) {
            setIsSupported(false)
            setLoading(false)
          }
          return
        }

        const hasPermission = Notification.permission === "granted"

        const { data, error } = await supabase
          .from("profiles")
          .select("push_subscription")
          .eq("id", userId)
          .single()

        if (error) {
          console.error("Error checking subscription:", error)
        }

        const hasSubscription = !!data?.push_subscription

        if (mountedRef.current) {
          setIsEnabled(hasPermission && hasSubscription)
          setLoading(false)
        }
      } catch (err) {
        console.error("Status check error:", err)
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

    checkStatus()

    return () => {
      mountedRef.current = false
    }
  }, [userId, supabase])

  const handleToggle = async () => {
    if (loading) return
    setLoading(true)
    
    try {
      let success = false
      
      if (isEnabled) {
        success = await unsubscribe(userId)
        if (success && mountedRef.current) {
          setIsEnabled(false)
        }
      } else {
        success = await subscribe(userId)
        if (success && mountedRef.current) {
          setIsEnabled(true)
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-2xl border border-yellow-200">
        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-yellow-900">
            Push notifications not supported
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Try using Chrome on Android or Safari on iOS 16.4+
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          isEnabled ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"
        )}>
          {isEnabled ? <Bell size={20} /> : <BellOff size={20} />}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Push Notifications</p>
          <p className="text-xs text-gray-600">
            {loading 
              ? "Checking..." 
              : isEnabled 
                ? "You'll receive notifications" 
                : "Get notified of new confessions"
            }
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading}
        className="relative h-7 w-12 cursor-pointer outline-none disabled:cursor-not-allowed"
        aria-label="Toggle push notifications"
      >
        <div className={cn(
          "h-full w-full rounded-full transition-colors duration-300",
          isEnabled ? "bg-green-600" : "bg-gray-300",
          loading && "opacity-50"
        )} />
        
        <motion.div
          className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md"
          animate={{ x: isEnabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {loading && <Loader2 size={12} className="animate-spin text-gray-600" />}
        </motion.div>
      </button>
    </div>
  )
          }
