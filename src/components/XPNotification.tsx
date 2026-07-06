"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, X } from 'lucide-react'

interface StarNotification {
  id: string
  amount: number
  reason: string
  type: 'earn' | 'spend'
  label?: string
}

interface StarToastProps {
  show: boolean
  notification: StarNotification | null
  onClose: () => void
}

export function StarNotificationToast({ show, notification, onClose }: StarToastProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !notification) return null

  const isEarning = notification.type === 'earn'
  const displayLabel = notification.label || (isEarning ? "Stars Earned!" : "Stars Spent")

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed top-16 right-4 z-[99999] w-[306px]"
        >
          <div className="relative flex items-start gap-2.5 py-2 px-3 rounded-lg border shadow-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 border-amber-500/20 dark:border-amber-500/30">
            
            {/* Amber Ascent Icon Container */}
            <div className="p-1.5 rounded-md shrink-0 bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400 mt-0.5">
              <Star className="w-4 h-4 fill-current" />
            </div>

            {/* Core Notification Copy */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">
                {displayLabel}
              </p>
              
              <div className="flex items-center gap-1 mt-0.5 leading-none">
                <span className="text-sm font-bold">
                  {isEarning ? '+' : '-'}{Math.abs(notification.amount)}
                </span>
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mx-1">•</span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[140px]">
                  {notification.reason}
                </p>
              </div>
            </div>

            {/* Manual Dismiss Action */}
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-0.5 rounded shrink-0 mt-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Countdown Micro-Bar */}
            <motion.div
              key={notification.id}
              className="absolute bottom-0 left-0 h-0.5 rounded-b-lg bg-amber-500 dark:bg-amber-400"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 4, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// Global Event Dispatcher State Management
let queue: StarNotification[] = []
let active: StarNotification | null = null
let stateListeners: Array<(notification: StarNotification | null) => void> = []
let activeTimer: NodeJS.Timeout | null = null

export function showNotification(amount: number, reason: string, type: 'earn' | 'spend' = 'earn', label?: string) {
  queue.push({
    id: Math.random().toString(36).substring(2, 9),
    amount,
    reason,
    type,
    label
  })
  next()
}

export function dismissNotification() {
  if (activeTimer) clearTimeout(activeTimer)
  active = null
  updateListeners()
  setTimeout(next, 150)
}

function next() {
  if (active || queue.length === 0) return
  active = queue.shift() || null
  updateListeners()

  activeTimer = setTimeout(() => {
    active = null
    updateListeners()
    next()
  }, 4000)
}

function updateListeners() {
  stateListeners.forEach(fn => fn(active))
}

export function useNotifications() {
  const [notification, setNotification] = useState<StarNotification | null>(null)
  
  useEffect(() => {
    stateListeners.push(setNotification)
    return () => {
      stateListeners = stateListeners.filter(fn => fn !== setNotification)
    }
  }, [])

  return {
    notification,
    show: !!notification,
    dismiss: dismissNotification
  }
}
