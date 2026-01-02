'use client'

import { useEffect, useState } from 'react'

export default function NotificationRegister() {
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
    }
  }, [])

  const subscribe = async () => {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // Replace with your actual Public VAPID Key
      applicationServerKey: 'BK1hA4tirxSR5qWYmkikKbl4QxHHwg-nGU1zIhThqA4wSAy3Fi65xR4DV-_CyYHyOqxDEviOQPtO3c0HuClqzm0' 
    })

    // SEND THIS 'subscription' OBJECT TO YOUR SUPABASE DATABASE
    // So you can trigger notifications later from the server.
    await fetch('/api/save-subscription', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: { 'Content-Type': 'application/json' }
    })
    
    alert('Notifications enabled!')
  }

  if (!isSupported) return null

  return (
    <button 
      onClick={subscribe}
      className="text-xs text-purple-400 underline decoration-purple-400/30"
    >
      Enable Push Notifications
    </button>
  )
      }
