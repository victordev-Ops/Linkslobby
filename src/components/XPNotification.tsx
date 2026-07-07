"use client"

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Star, X } from 'lucide-react'

interface XPNotification {
  id: string
  amount: number
  reason: string
  type: 'earn' | 'spend'
  label?: string
}

interface XPNotificationProps {
  show?: boolean
  amount?: number
  reason?: string
  type?: 'earn' | 'spend'
  label?: string
  onComplete?: () => void
  onClose?: () => void
}

// Global hook listener state to support existing files using useXPNotifications()
let queueListeners: Array<(notification: XPNotification | null) => void> = []
let activeNotificationState: XPNotification | null = null

const XP_TOAST_ID = 'global-xp-notification-toast'

/**
 * Global Toaster Component Bridge
 * We return null here because ClientLayout.tsx ALREADY mounts a global <Toaster />.
 * Mounting a second one here was causing the literal visual overlap/double-rendering bug.
 */
export function XPNotificationToast({ show, amount, reason, type, onComplete }: XPNotificationProps) {
  return null 
}

/**
 * Triggers a sonner toast injection with an amber ascent profile
 */
export function showXPNotification(amount: number, reason: string, type: 'earn' | 'spend' = 'earn', label?: string) {
  const isEarning = type === 'earn'
  const displayLabel = label || (isEarning ? "Stars Earned!" : "Stars Spent")
  const displayAmount = Math.abs(amount)
  
  const payload: XPNotification = {
    id: XP_TOAST_ID,
    amount: displayAmount,
    reason,
    type,
    label
  }

  activeNotificationState = payload
  queueListeners.forEach(fn => fn(payload))

  // Dismiss any existing XP toast before firing a new one to keep it perfectly clean
  toast.dismiss(XP_TOAST_ID)

  toast.custom((t) => (
    <div className="relative flex items-start gap-2.5 py-2 px-3 rounded-lg border shadow-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 border-amber-500/20 dark:border-amber-500/30 w-[306px]">
      
      {/* Amber Ascent Star Branding */}
      <div className="p-1.5 rounded-md shrink-0 bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400 mt-0.5">
        <Star className="w-4 h-4 fill-current" />
      </div>

      {/* Content Layout */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">
          {displayLabel}
        </p>
        <div className="flex items-center gap-1 mt-0.5 leading-none">
          <span className="text-sm font-bold">
            {isEarning ? '+' : '-'}{displayAmount}
          </span>
          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
          <span className="text-xs text-zinc-400 dark:text-zinc-500 mx-1">•</span>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[140px]">
            {reason}
          </p>
        </div>
      </div>

      {/* Manual Dismiss Trigger */}
      <button 
        onClick={() => {
          toast.dismiss(t)
          activeNotificationState = null
          queueListeners.forEach(fn => fn(null))
        }}
        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-0.5 rounded shrink-0 mt-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        aria-label="Close notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  ), {
    id: XP_TOAST_ID, // Use fixed ID to prevent stacking overlap
    duration: 4000,
    onAutoClose: () => {
      activeNotificationState = null
      queueListeners.forEach(fn => fn(null))
    }
  })
}

/**
 * Preserved Hook Layer
 * Retains compatibility with layout contexts monitoring internal application alerts.
 */
export function useXPNotifications() {
  const [notification, setNotification] = useState<XPNotification | null>(activeNotificationState)
  
  useEffect(() => {
    queueListeners.push(setNotification)
    return () => {
      queueListeners = queueListeners.filter(fn => fn !== setNotification)
    }
  }, [])

  return notification
    }
        
