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
      const timer = setTimeout(onComplete, 5000)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.5, rotateX: -90 }}
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: 1,
            rotateX: 0,
          }}
          exit={{ 
            opacity: 0, 
            y: -20, 
            scale: 0.9,
            rotateX: 10
          }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 20,
            mass: 0.8
          }}
          className="fixed top-16 right-4 z-[100] pointer-events-none max-w-sm"
          style={{ fontFamily: 'Roboto, sans-serif', perspective: '1000px' }}
        >
          <div className="relative">
            {/* Particle effects */}
            <div className="absolute inset-0 flex items-center justify-center">
              {[...Array(12)].map((_, i) => (
                <Particle key={i} delay={i * 0.05} />
              ))}
            </div>

            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 rounded-2xl blur-xl opacity-60"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.6, 0.8, 0.6]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            {/* Main notification card */}
            <motion.div
              className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white rounded-2xl shadow-2xl p-5 pr-6 min-w-[320px] border-2 border-orange-300 backdrop-blur-sm"
              animate={{
                boxShadow: [
                  "0 20px 60px rgba(249, 115, 22, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                  "0 25px 80px rgba(249, 115, 22, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.2)",
                  "0 20px 60px rgba(249, 115, 22, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="flex items-center gap-4">
                {/* Animated star icon */}
                <motion.div
                  animate={{
                    rotate: [0, 15, -15, 0],
                    scale: [1, 1.15, 1],
                  }}
                  transition={{
                    rotate: { duration: 1.5, ease: "easeInOut", repeat: Infinity },
                    scale: { duration: 0.8, repeat: Infinity, repeatType: "reverse" }
                  }}
                  className="relative bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-full p-3 shadow-lg"
                >
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-6 h-6 text-orange-900" fill="currentColor" />
                  </motion.div>
                  {/* Pulsing dot */}
                  <motion.div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-200 rounded-full"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [1, 0.5, 1]
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                </motion.div>

                <div className="flex-1">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: [0, 1.3, 1], rotate: 0 }}
                    transition={{ 
                      scale: { duration: 0.6, delay: 0.2, type: "spring", stiffness: 200 },
                      rotate: { duration: 0.6, delay: 0.2 }
                    }}
                    className="flex items-baseline gap-2 mb-1.5"
                  >
                    <motion.span 
                      className="text-4xl font-black text-yellow-200 drop-shadow-lg"
                      animate={{
                        textShadow: [
                          "0 0 10px rgba(255, 255, 255, 0.5)",
                          "0 0 20px rgba(255, 255, 255, 0.8)",
                          "0 0 10px rgba(255, 255, 255, 0.5)",
                        ]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      +{amount}
                    </motion.span>
                    <motion.span 
                      className="text-2xl font-bold text-yellow-300"
                      animate={{
                        rotate: [0, 20, -20, 0],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                    >
                      ⭐
                    </motion.span>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm text-orange-100 font-medium"
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
                className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-yellow-300 via-yellow-200 to-yellow-300 rounded-full shadow-lg"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 5, ease: "linear" }}
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
