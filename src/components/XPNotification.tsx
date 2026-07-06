"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Coins, X } from 'lucide-react'

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

  // Debug logging (only in development)
  useEffect(() => {
    if (show && process.env.NODE_ENV === 'development') {
      console.log('🎉 XP Notification:', { amount, reason, type, isEarning })
    }
  }, [show, amount, reason, type, isEarning])

  if (!mounted) return null

  const notificationContent = (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed top-16 right-4 z-[99999] max-w-sm w-full sm:w-[360px]"
        >
          <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 ${
            isEarning 
              ? 'border-emerald-100 dark:border-emerald-500/20' 
              : 'border-red-100 dark:border-red-500/20'
          }`}>
            
            {/* Minimal Status Icon */}
            <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${
              isEarning 
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
                : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
            }`}>
              {isEarning ? <Sparkles className="w-5 h-5" /> : <Coins className="w-5 h-5" />}
            </div>

            {/* Notification Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className={`text-base font-bold ${
                  isEarning ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {isEarning ? '+' : '-'}{displayAmount} XP
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                {reason}
              </p>
            </div>

            {/* Manual Dismiss Button */}
            {onComplete && (
              <button 
                onClick={onComplete}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-1 rounded-md shrink-0"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Subtle bottom timer progress bar */}
            <motion.div
              className={`absolute bottom-0 left-0 h-0.5 rounded-b-xl ${
                isEarning ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-red-500 dark:bg-red-400'
              }`}
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

// Global XP notification manager (Unchanged backend logic)
let notificationQueue: XPNotification[] = []
let currentNotification: XPNotification | null = null
let listeners: Array<(notification: XPNotification | null) => void> = []

export function showXPNotification(amount: number, reason: string, type: 'earn' | 'spend' = 'earn') {
  if (process.env.NODE_ENV === 'development') {
    console.log('🎯 showXPNotification called:', { amount, reason, type })
  }
  const notification: XPNotification = {
    id: Math.random().toString(36).substr(2, 9),
    amount: Math.abs(amount),
    reason,
    type
  }

  notificationQueue.push(notification)
  if (process.env.NODE_ENV === 'development') {
    console.log('📋 Notification queue length:', notificationQueue.length)
  }
  processQueue()
}

function processQueue() {
  if (currentNotification || notificationQueue.length === 0) return
  
  currentNotification = notificationQueue.shift() || null
  if (process.env.NODE_ENV === 'development') {
    console.log('📬 Processing notification:', currentNotification)
  }
  notifyListeners()

  setTimeout(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('⏰ Notification timeout, clearing:', currentNotification)
    }
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
