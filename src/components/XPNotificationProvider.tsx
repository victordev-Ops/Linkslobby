"use client"

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { XPNotificationToast, useXPNotifications, showXPNotification } from './XPNotification'

export function XPNotificationProvider({ children }: { children: React.ReactNode }) {
  const notification = useXPNotifications()
  const supabase = createClient()

  useEffect(() => {
    let transactionChannel: ReturnType<typeof supabase.channel> | null = null;
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    let lastBalance = 0;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get initial balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp_balance')
        .eq('id', user.id)
        .single()
      
      if (profile) {
        lastBalance = profile.xp_balance || 0
      }

      // Listen to XP transactions (primary source)
      transactionChannel = supabase
        .channel(`xp-notification-transactions-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'xp_transactions',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newRecord = payload.new as { amount: number, reason: string, type: 'earn' | 'spend' }
            // Only show notifications for earning XP (positive amounts)
            if (newRecord.type === 'earn' && newRecord.amount > 0) {
              showXPNotification(newRecord.amount, newRecord.reason)
            }
          }
        )
        .subscribe()

      // Also listen to profile updates as a fallback (for server-side XP changes)
      profileChannel = supabase
        .channel(`xp-notification-profile-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          async (payload) => {
            if (payload.new && 'xp_balance' in payload.new) {
              const newBalance = payload.new.xp_balance as number
              const diff = newBalance - lastBalance
              
              // Only show notification if XP increased significantly (to avoid spam)
              if (diff > 0 && diff >= 2) {
                // Fetch the most recent transaction to get the reason
                const { data: transactions } = await supabase
                  .from('xp_transactions')
                  .select('amount, reason')
                  .eq('user_id', user.id)
                  .eq('type', 'earn')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .single()
                
                if (transactions) {
                  showXPNotification(transactions.amount, transactions.reason)
                } else {
                  // Fallback if transaction not found
                  showXPNotification(diff, 'Stars Earned')
                }
              }
              
              lastBalance = newBalance
            }
          }
        )
        .subscribe()
    }

    setupSubscription()

    return () => {
      if (transactionChannel) supabase.removeChannel(transactionChannel)
      if (profileChannel) supabase.removeChannel(profileChannel)
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
