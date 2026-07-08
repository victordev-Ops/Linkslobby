'use client'

import { useEffect, useRef } from 'react'

const REGISTER_ATTEMPT_KEY = 'say-app:push-register-attempted-v1'

const VAPID_PUBLIC_KEY =
  'BK1hA4tirxSR5qWYmkikKbl4QxHHwg-nGU1zIhThqA4wSAy3Fi65xR4DV-_CyYHyOqxDEviOQPtO3c0HuClqzm0'

export default function NotificationRegister() {
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return
    }

    if (Notification.permission === 'denied') return
    if (typeof window !== 'undefined' && localStorage.getItem(REGISTER_ATTEMPT_KEY) === 'granted') return

    const attemptSubscribe = async () => {
      if (attemptedRef.current) return
      attemptedRef.current = true

      try {
        const registration = await navigator.serviceWorker.ready

        const existing = await registration.pushManager.getSubscription()
        if (existing) {
          localStorage.setItem(REGISTER_ATTEMPT_KEY, 'granted')
          return
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_PUBLIC_KEY,
        })

        await fetch('/api/save-subscription', {
          method: 'POST',
          body: JSON.stringify(subscription),
          headers: { 'Content-Type': 'application/json' },
        })

        localStorage.setItem(
          REGISTER_ATTEMPT_KEY,
          Notification.permission === 'granted' ? 'granted' : 'declined'
        )
      } catch (error) {
        console.error('[push] auto-subscribe failed:', error)
        localStorage.setItem(REGISTER_ATTEMPT_KEY, 'declined')
      } finally {
        cleanup()
      }
    }

    const cleanup = () => {
      document.removeEventListener('click', attemptSubscribe)
      document.removeEventListener('touchstart', attemptSubscribe)
      document.removeEventListener('keydown', attemptSubscribe)
    }

    document.addEventListener('click', attemptSubscribe, { once: true })
    document.addEventListener('touchstart', attemptSubscribe, { once: true })
    document.addEventListener('keydown', attemptSubscribe, { once: true })

    return cleanup
  }, [])

  return null
          }
