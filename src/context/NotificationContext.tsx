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
  profileId?: string | null
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    if (!profileId) {
      setUnreadCount(0)
      return
    }

    // Initial fetch
    const fetchInitialCount = async () => {
      const { count, error } = await supabase
        .from('confessions')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('is_read', false)
      
      if (error) {
        console.error('Error fetching unread count:', error)
        return
      }
      
      setUnreadCount(count || 0)
    }

    fetchInitialCount()

    // Real-time subscription
    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, () => {
        setUnreadCount(prev => prev + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, (payload) => {
        if (payload.new.is_read && !payload.old.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
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
