"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Coins } from 'lucide-react'

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

// Particle component for sparkle effect
const Particle = ({ delay, isEarning }: { delay: number; isEarning: boolean }) => {
  const randomX = Math.random() * 200 - 100
  const randomY = Math.random() * 200 - 100
  
  return (
    <motion.div
      className={`absolute w-2 h-2 rounded-full ${
        isEarning ? 'bg-yellow-400' : 'bg-red-400'
      }`}
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

  // Debug logging
  useEffect(() => {
    if (show) {
      console.log('🎉 XP Notification:', { amount, reason, type, isEarning })
    }
  }, [show, amount, reason, type, isEarning])

  const notificationContent = (
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
          className="fixed top-16 right-4 z-[99999] pointer-events-none max-w-sm"
          style={{ fontFamily: 'Roboto, sans-serif', perspective: '1000px' }}
        >
          <div className="relative">
            {/* Particle effects */}
            <div className="absolute inset-0 flex items-center justify-center">
              {[...Array(12)].map((_, i) => (
                <Particle key={i} delay={i * 0.05} isEarning={isEarning} />
              ))}
            </div>

            {/* Outer glow ring */}
            <motion.div
              className={`absolute inset-0 rounded-2xl blur-xl opacity-60 ${
                isEarning 
                  ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400' 
                  : 'bg-gradient-to-r from-red-400 via-pink-400 to-red-400'
              }`}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.6, 0.8, 0.6]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            {/* Main notification card */}
            <motion.div
              className={`relative text-white rounded-2xl shadow-2xl p-5 pr-6 min-w-[320px] border-2 backdrop-blur-sm ${
                isEarning
                  ? 'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 border-orange-300'
                  : 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 border-red-300'
              }`}
              animate={{
                boxShadow: isEarning ? [
                  "0 20px 60px rgba(249, 115, 22, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                  "0 25px 80px rgba(249, 115, 22, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.2)",
                  "0 20px 60px rgba(249, 115, 22, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                ] : [
                  "0 20px 60px rgba(239, 68, 68, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                  "0 25px 80px rgba(239, 68, 68, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.2)",
                  "0 20px 60px rgba(239, 68, 68, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="flex items-center gap-4">
                {/* Animated icon */}
                <motion.div
                  animate={{
                    rotate: isEarning ? [0, 15, -15, 0] : [0, -10, 10, 0],
                    scale: [1, 1.15, 1],
                  }}
                  transition={{
                    rotate: { duration: 1.5, ease: "easeInOut", repeat: Infinity },
                    scale: { duration: 0.8, repeat: Infinity, repeatType: "reverse" }
                  }}
                  className={`relative rounded-full p-3 shadow-lg ${
                    isEarning
                      ? 'bg-gradient-to-br from-yellow-300 to-yellow-400'
                      : 'bg-gradient-to-br from-red-300 to-red-400'
                  }`}
                >
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    {isEarning ? (
                      <Sparkles className={`w-6 h-6 ${isEarning ? 'text-orange-900' : 'text-red-900'}`} fill="currentColor" />
                    ) : (
                      <Coins className="w-6 h-6 text-red-900" />
                    )}
                  </motion.div>
                  {/* Pulsing dot */}
                  <motion.div
                    className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                      isEarning ? 'bg-yellow-200' : 'bg-red-200'
                    }`}
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
                      className={`text-4xl font-black drop-shadow-lg ${
                        isEarning ? 'text-yellow-200' : 'text-red-200'
                      }`}
                      animate={{
                        textShadow: [
                          `0 0 10px rgba(255, 255, 255, 0.5)`,
                          `0 0 20px rgba(255, 255, 255, 0.8)`,
                          `0 0 10px rgba(255, 255, 255, 0.5)`,
                        ]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {isEarning ? '+' : '-'}{displayAmount}
                    </motion.span>
                    <motion.span 
                      className={`text-2xl font-bold ${
                        isEarning ? 'text-yellow-300' : 'text-red-300'
                      }`}
                      animate={{
                        rotate: [0, 20, -20, 0],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {isEarning ? '⭐' : '💸'}
                    </motion.span>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className={`text-sm font-medium ${
                      isEarning ? 'text-orange-100' : 'text-red-100'
                    }`}
                  >
                    {reason}
                  </motion.p>
                </div>

                {/* Decoration icon */}
                <motion.div
                  animate={{
                    rotate: [0, 180, 360],
                    scale: [1, 1.3, 1],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  {isEarning ? (
                    <Sparkles className={`w-5 h-5 ${isEarning ? 'text-yellow-300' : 'text-red-300'}`} />
                  ) : (
                    <Coins className="w-5 h-5 text-red-300" />
                  )}
                </motion.div>
              </div>

              {/* Progress bar for auto-dismiss */}
              <motion.div
                className={`absolute bottom-0 left-0 h-1.5 rounded-full shadow-lg ${
                  isEarning
                    ? 'bg-gradient-to-r from-yellow-300 via-yellow-200 to-yellow-300'
                    : 'bg-gradient-to-r from-red-300 via-red-200 to-red-300'
                }`}
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

  // Render in portal to escape any stacking contexts
  if (!mounted) return null
  
  return createPortal(notificationContent, document.body)
}

// Global XP notification manager
let notificationQueue: XPNotification[] = []
let currentNotification: XPNotification | null = null
let listeners: Array<(notification: XPNotification | null) => void> = []

export function showXPNotification(amount: number, reason: string, type: 'earn' | 'spend' = 'earn') {
  console.log('🎯 showXPNotification called:', { amount, reason, type })
  const notification: XPNotification = {
    id: Math.random().toString(36).substr(2, 9),
    amount: Math.abs(amount),
    reason,
    type
  }

  notificationQueue.push(notification)
  console.log('📋 Notification queue length:', notificationQueue.length)
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
