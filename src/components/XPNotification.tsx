"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, X } from 'lucide-react'

interface XPNotification {
  id: string
  amount: number
  reason: string
  type: 'earn' | 'spend'
}

interface XPNotificationProps {
  show: boolean
  amount: number
  reason: string
  type: 'earn' | 'spend'
  onComplete?: () => void
}

export function XPNotificationToast({ show, amount, reason, type, onComplete }: XPNotificationProps) {
  const [mounted, setMounted] = useState(false)
  const isEarning = type === 'earn'
  const displayAmount = Math.abs(amount)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 5000)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  if (!mounted) return null

  const notificationContent = (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed top-16 right-4 z-[99999] w-[306px]" // Width reduced by 15% (360px -> 306px)
        >
          {/* Height reduced by ~30% using tighter vertical padding (py-2) and text sizes */}
          <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg border shadow-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 border-amber-500/20 dark:border-amber-500/30">
            
            {/* Amber Status Icon */}
            <div className="p-1.5 rounded-md shrink-0 bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400">
              <Star className="w-4 h-4 fill-current" />
            </div>

            {/* Notification Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 leading-none">
                <span className={`text-sm font-bold ${
                  isEarning ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'
                }`}>
                  {isEarning ? '+' : '-'}{displayAmount}
                </span>
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-[210px]">
                {reason}
              </p>
            </div>

            {/* Dismiss Button */}
            {onComplete && (
              <button 
                onClick={onComplete}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-0.5 rounded shrink-0"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Amber Progress Bar */}
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 rounded-b-lg bg-amber-500 dark:bg-amber-400"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 5, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(notificationContent, document.body)
}

// Global notification queue system (Preserved framework architecture)
let notificationQueue: XPNotification[] = []
let currentNotification: XPNotification | null = null
let listeners: Array<(notification: XPNotification | null) => void> = []

export function showXPNotification(amount: number, reason: string, type: 'earn' | 'spend' = 'earn') {
  const notification: XPNotification = {
    id: Math.random().toString(36).substr(2, 9),
    amount: Math.abs(amount),
    reason,
    type
  }
  notificationQueue.push(notification)
  processQueue()
}

function processQueue() {
  if (currentNotification || notificationQueue.length === 0) return
  currentNotification = notificationQueue.shift() || null
  notifyListeners()

  setTimeout(() => {
    currentNotification = null
    notifyListeners()
    processQueue()
  }, 5000)
}

function notifyListeners() {
  listeners.forEach(listener => listener(currentNotification))
}

export function useXPNotifications() {
  const [notification, setNotification] = useState<XPNotification | null>(null)
  useEffect(() => {
    listeners.push(setNotification)
    return () => {
      listeners = listeners.filter(l => l !== setNotification)
    }
  }, [])
  return notification
}
