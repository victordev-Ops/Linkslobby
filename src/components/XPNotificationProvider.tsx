"use client"

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { showXPNotification } from './XPNotification'

// How long to wait for more XP events before flushing what's buffered into a
// single toast. This is the fix for XP toasts specifically stacking during a
// burst — e.g. finishing several turns back to back can insert 3-4
// xp_transactions rows within a second, which previously fired 3-4 separate
// toasts on top of each other. Earn and spend are buffered separately since
// they're different colors/meanings and shouldn't be summed together.
const XP_BATCH_WINDOW_MS = 700

type PendingXP = { id: string; amount: number; reason: string }

export function XPNotificationProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const bufferRef = useRef<Record<'earn' | 'spend', PendingXP[]>>({ earn: [], spend: [] })
  const flushTimerRef = useRef<Record<'earn' | 'spend', ReturnType<typeof setTimeout> | null>>({ earn: null, spend: null })

  const flushXP = (type: 'earn' | 'spend') => {
    const items = bufferRef.current[type]
    bufferRef.current[type] = []
    flushTimerRef.current[type] = null
    if (items.length === 0) return

    if (items.length === 1) {
      const only = items[0]
      showXPNotification(only.amount, only.reason, type, undefined, only.id)
      return
    }

    // Multiple events landed within the batch window — show one combined
    // toast instead of one per event. Use the last item's id for dedup
    // (with a batch prefix so it never collides with a later single-event
    // toast that happens to reuse the same underlying row id).
    const total = items.reduce((sum, i) => sum + i.amount, 0)
    const label = type === 'earn' ? 'Stars Earned!' : 'Stars Spent'
    const reason = `${items.length} events`
    const batchId = `xp-batch:${type}:${items[items.length - 1].id}`
    showXPNotification(total, reason, type, label, batchId)
  }

  const enqueueXP = (type: 'earn' | 'spend', item: PendingXP) => {
    bufferRef.current[type].push(item)
    if (!flushTimerRef.current[type]) {
      flushTimerRef.current[type] = setTimeout(() => flushXP(type), XP_BATCH_WINDOW_MS)
    }
  }

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
            try {
              const newRecord = payload.new as { id: string, amount: number, reason: string, type: 'earn' | 'spend' }
              if (process.env.NODE_ENV === 'development') {
                console.log('📊 XP Transaction detected:', newRecord)
              }
              // Queue notifications for all XP events (both earning and spending).
              // Amount is always positive in the database, type indicates earn/spend.
              // Actual display is batched — see enqueueXP/flushXP above — so a
              // burst of events renders as one toast, not a stack of them.
              if (newRecord && newRecord.amount > 0 && newRecord.reason) {
                const type = newRecord.type || 'earn'
                if (process.env.NODE_ENV === 'development') {
                  console.log('🔔 Queuing XP notification:', { amount: newRecord.amount, reason: newRecord.reason, type })
                }
                enqueueXP(type, { id: newRecord.id, amount: newRecord.amount, reason: newRecord.reason })
              }
            } catch (error) {
              console.error('Error processing XP transaction notification:', error)
            }
          }
        )
        .subscribe((status) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('📡 Transaction subscription status:', status)
            if (status === 'SUBSCRIBED') {
              console.log('✅ Successfully subscribed to XP transactions')
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Failed to subscribe to XP transactions')
            }
          }
        })

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

              // Only handle negative changes (spending) or very large changes here
              // Positive changes are better handled by the xp_transactions listener which has the reason
              // But we keep this as a fallback for cases where transaction might be missed or delayed

              if (Math.abs(diff) >= 2) {
                // Wait a moment to see if transaction listener picked it up
                // unique ID for this 'event' based on time/amount to dedup? 
                // simpler: just check if we recently showed a notification? 
                // actually, the transaction listener is faster usually. 

                // refined logic: 
                // if diff > 0, we expect an insert in xp_transactions. 
                // if diff < 0, we might NOT have an insert if it's a penalty or system action that didn't log properly (though it should).

                // Let's rely on transactions for "Earn" mainly.
                // For "Spend", we also rely on transactions usually. 
                // This fallback checks if 500ms passed without a notification, then shows it? 
                // That's complex. 

                // Simplification for User Request "more descriptive":
                // Real-time transactions are the best source. 
                // We will IGNORE profile updates for notification purposes if they are positive, 
                // assuming the transaction will cover it. 
                // We only use this for "Spend" if we desperately need to, but even then, Spend should have a transaction.

                // Current issue might be that "daily login" generates a transaction, so we get the transaction notification. 
                // Then profile updates, and we get a "generic" notification.
                // FIX: Don't show generic notifications from profile updates if a recent transaction notification happened.

                // actually, let's just use the profile listener to update local balance ref, 
                // but NOT trigger notifications unless we are sure we missed it.
                // For now, I will COMMENT OUT the notification trigger from profile updates 
                // because `xp_transactions` is the source of truth for "events". 
                // If the balance changes without a transaction, users will see the balance update in the UI anyway.
                // Showing a "You gained X stars" without a reason is confusing.

                lastBalance = newBalance
              }
            }
          }
        )
        .subscribe((status) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('📡 Profile subscription status:', status)
            if (status === 'SUBSCRIBED') {
              console.log('✅ Successfully subscribed to profile updates')
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Failed to subscribe to profile updates')
            }
          }
        })
    }

    setupSubscription()

    return () => {
      if (transactionChannel) supabase.removeChannel(transactionChannel)
      if (profileChannel) supabase.removeChannel(profileChannel)
      if (flushTimerRef.current.earn) clearTimeout(flushTimerRef.current.earn)
      if (flushTimerRef.current.spend) clearTimeout(flushTimerRef.current.spend)
    }
  }, [supabase])

  return <>{children}</>
                  }
