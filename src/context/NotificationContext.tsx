'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type NotificationContextType = {
  unreadCount: number
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>
  refreshUnreadCount: () => Promise<void>
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

  // Memoized refresh function
  const refreshUnreadCount = useCallback(async () => {
    if (!profileId) {
      setUnreadCount(0)
      return
    }

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
  }, [profileId, supabase])

  useEffect(() => {
    if (!profileId) {
      setUnreadCount(0)
      return
    }

    // Initial fetch
    refreshUnreadCount()

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
        // Type guard to ensure payload has the expected structure
        const newData = payload.new as { is_read?: boolean }
        const oldData = payload.old as { is_read?: boolean }
        
        if (newData.is_read && !oldData.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, (payload) => {
        // Type guard for delete event
        const oldData = payload.old as { is_read?: boolean }
        
        if (!oldData.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [profileId, supabase, refreshUnreadCount])

  return (
    <NotificationContext.Provider value={{ unreadCount, setUnreadCount, refreshUnreadCount }}>
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
