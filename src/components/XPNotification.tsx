"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Coins } from 'lucide-react'

interface XPNotification {
  id: string
  amount: number
  reason: string
}

interface XPNotificationProps {
  show: boolean
  amount: number
  reason: string
  onComplete?: () => void
}

// Particle component for sparkle effect
const Particle = ({ delay }: { delay: number }) => {
  const randomX = Math.random() * 200 - 100
  const randomY = Math.random() * 200 - 100
  
  return (
    <motion.div
      className="absolute w-2 h-2 bg-yellow-400 rounded-full"
      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
      animate={{ 
        opacity: [0, 1, 0],
        scale: [0, 1, 0],
        x: randomX,
        y: randomY,
      }}
      transition={{
        duration: 1.2,
        delay,
        ease: "easeOut"
      }}
    />
  )
}

export function XPNotificationToast({ show, amount, reason, onComplete }: XPNotificationProps) {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 4000)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-20 right-4 z-[100] pointer-events-none"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          <div className="relative">
            {/* Particle effects */}
            <div className="absolute inset-0 flex items-center justify-center">
              {[...Array(12)].map((_, i) => (
                <Particle key={i} delay={i * 0.05} />
              ))}
            </div>

            {/* Main notification card */}
            <motion.div
              className="bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-2xl shadow-2xl p-5 pr-6 min-w-[280px] border-2 border-purple-400"
              animate={{
                boxShadow: [
                  "0 20px 60px rgba(147, 51, 234, 0.4)",
                  "0 20px 80px rgba(147, 51, 234, 0.6)",
                  "0 20px 60px rgba(147, 51, 234, 0.4)",
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="flex items-center gap-4">
                {/* Animated coin icon */}
                <motion.div
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    rotate: { duration: 2, ease: "easeInOut" },
                    scale: { duration: 0.5, repeat: Infinity, repeatType: "reverse" }
                  }}
                  className="bg-yellow-400 rounded-full p-3 shadow-lg"
                >
                  <Coins className="w-6 h-6 text-purple-900" />
                </motion.div>

                <div className="flex-1">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="flex items-baseline gap-2 mb-1"
                  >
                    <span className="text-3xl font-bold text-yellow-300">
                      +{amount}
                    </span>
                    <span className="text-lg font-medium text-yellow-200">XP</span>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm text-purple-100"
                  >
                    {reason}
                  </motion.p>
                </div>

                {/* Sparkle decoration */}
                <motion.div
                  animate={{
                    rotate: [0, 180, 360],
                    scale: [1, 1.3, 1],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                </motion.div>
              </div>

              {/* Progress bar for auto-dismiss */}
              <motion.div
                className="absolute bottom-0 left-0 h-1 bg-yellow-300 rounded-full"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 4, ease: "linear" }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Global XP notification manager
let notificationQueue: XPNotification[] = []
let currentNotification: XPNotification | null = null
let listeners: Array<(notification: XPNotification | null) => void> = []

export function showXPNotification(amount: number, reason: string) {
  const notification: XPNotification = {
    id: Math.random().toString(36).substr(2, 9),
    amount,
    reason
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
  }, 4000)
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
