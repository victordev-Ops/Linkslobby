'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type NotificationContextType = {
  unreadCount: number
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ 
  children, 
  profileId 
}: { 
  children: React.ReactNode
  profileId?: string | null   // ← Made optional
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    if (!profileId) {
      // No user → reset count and skip subscription
      setUnreadCount(0)
      return
    }

    // Initial fetch
    const fetchInitialCount = async () => {
      const { count } = await supabase
        .from('confessions')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('is_read', false)
      
      setUnreadCount(count || 0)
    }

    fetchInitialCount()

    // Real-time subscription
    const channel = supabase
      .channel(`global-notifications-${profileId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setUnreadCount(prev => prev + 1)
        }
        if (payload.eventType === 'UPDATE') {
          if (payload.new.is_read && !payload.old.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1))
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeAllChannels() // or specifically remove channel
    }
  }, [profileId, supabase])

  return (
    <NotificationContext.Provider value={{ unreadCount, setUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
        }
