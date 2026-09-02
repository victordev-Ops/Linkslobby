'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { showXPNotification } from '@/components/XPNotification'

export function GlobalXPListener({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel('global-xp-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'xp_transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const tx = payload.new
          const type = tx.amount > 0 ? 'earn' : 'spend'
          
          showXPNotification(
            Math.abs(tx.amount), 
            tx.reason || 'Stars Updated', 
            type
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return null
}
