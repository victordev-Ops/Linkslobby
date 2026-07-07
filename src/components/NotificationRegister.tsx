'use client'

import { useEffect, useRef } from 'react'

export default function NotificationRegister() {
  const hasPrompted = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return
    }

    const subscribe = async () => {
      // Don't re-prompt if handled in a previous session or if already decided
      if (hasPrompted.current || localStorage.getItem('push_prompted') || Notification.permission !== 'default') {
        return
      }

      try {
        hasPrompted.current = true
        localStorage.setItem('push_prompted', 'true')

        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // Replace with your actual Public VAPID Key
          applicationServerKey: 'BK1hA4tirxSR5qWYmkikKbl4QxHHwg-nGU1zIhThqA4wSAy3Fi65xR4DV-_CyYHyOqxDEviOQPtO3c0HuClqzm0' 
        })

        await fetch('/api/save-subscription', {
          method: 'POST',
          body: JSON.stringify(subscription),
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        console.error('Push registration failed:', error)
      }
    }

    const handleGesture = () => {
      if (Notification.permission === 'default') {
        subscribe()
      }
    }

    // Bind to the first natural user interaction to ensure browser compliance
    document.addEventListener('click', handleGesture, { once: true })
    document.addEventListener('touchstart', handleGesture, { once: true })

    return () => {
      document.removeEventListener('click', handleGesture)
      document.removeEventListener('touchstart', handleGesture)
    }
  }, [])

  // Component acts silently in the background, no manual UI required.
  return null
}
