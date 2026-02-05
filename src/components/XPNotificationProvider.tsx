"use client"

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { XPNotificationToast, useXPNotifications, showXPNotification } from './XPNotification'

export function XPNotificationProvider({ children }: { children: React.ReactNode }) {
  const notification = useXPNotifications()
  const supabase = createClient()

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`xp-notification-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'xp_transactions',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newRecord = payload.new as { amount: number, reason: string }
            showXPNotification(newRecord.amount, newRecord.reason)
          }
        )
        .subscribe()
    }

    setupSubscription()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <>
      {children}
      <XPNotificationToast
        show={!!notification}
        amount={notification?.amount || 0}
        reason={notification?.reason || ''}
      />
    </>
  )
}
