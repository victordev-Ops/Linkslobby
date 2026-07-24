"use client"

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { showAppToast } from './AppToast'
import { StarAmount } from './StarAmount'

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

/**
 * NOTE: This used to render its own <Toaster>. That's what caused every
 * realtime toast in the app to appear twice, stacked and overlapping —
 * ClientLayout.tsx already mounts the ONE app-wide <Toaster>, and every
 * mounted <Toaster> independently renders whatever's in Sonner's shared
 * queue. Having two Toasters meant two renders of every single toast.
 * There must only ever be one <Toaster> in the tree. This component is
 * kept (as a no-op) only so existing imports of XPNotificationToast don't
 * break; it can be removed entirely once nothing renders it anymore.
 */
export function XPNotificationToast(_props: XPNotificationProps) {
  return null
}

/**
 * Triggers an XP toast through showAppToast — the same card, spacing, and
 * stacking behavior as every other toast in the app (messages, friend
 * requests, Hot Seat, etc). This used to render its own bespoke toast.custom
 * card (different width, different padding, hand-rolled close button), which
 * is what made XP toasts look and stack differently from everything else.
 *
 * `id` should be the underlying xp_transactions row id when available (see
 * XPNotificationProvider). Passing a stable id means a re-fired realtime
 * event (reconnect replay, dual-tab) updates the existing toast in place
 * instead of stacking a duplicate — the same dedup mechanism showAppToast
 * already uses for every other notification type.
 */
export function showXPNotification(
  amount: number,
  reason: string,
  type: 'earn' | 'spend' = 'earn',
  label?: string,
  id?: string
) {
  const isEarning = type === 'earn'
  const displayLabel = label || (isEarning ? "Stars Earned!" : "Stars Spent")
  const displayAmount = Math.abs(amount)
  const toastId = id ? `xp:${id}` : Math.random().toString(36).substring(2, 9)

  const payload: XPNotification = {
    id: toastId,
    amount: displayAmount,
    reason,
    type,
    label
  }

  activeNotificationState = payload
  queueListeners.forEach(fn => fn(payload))

  const duration = 4000

  showAppToast(displayLabel, {
    id: toastId,
    icon: Star,
    variant: 'xp',
    description: (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <StarAmount amount={displayAmount} type={type} size="sm" />
        <span className="opacity-70">{reason}</span>
      </span>
    ),
    duration,
  })

  // showAppToast doesn't expose an onAutoClose hook (sonner's toast.custom
  // callback isn't threaded through it), so we mirror the toast's own
  // duration here to keep useXPNotifications()'s legacy state in sync.
  // Manual dismiss (the X button) isn't observable from here either — this
  // listener state is a compatibility shim for old callers of the hook, not
  // something the current toast UI depends on.
  setTimeout(() => {
    if (activeNotificationState?.id === toastId) {
      activeNotificationState = null
      queueListeners.forEach(fn => fn(null))
    }
  }, duration)
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
