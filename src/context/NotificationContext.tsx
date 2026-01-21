'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type NotificationContextType = {
  unreadCount: number
  unreadMessagesCount: number
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>
  setUnreadMessagesCount: React.Dispatch<React.SetStateAction<number>>
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
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const refreshUnreadCount = useCallback(async () => {
    if (!profileId) {
      setUnreadCount(0)
      return
    }

    const [confRes, dykmRes] = await Promise.all([
      supabase
        .from('confessions')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('is_read', false),
      supabase
        .from('dykm_scores')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_owner_id', profileId)
        .eq('is_read', false)
    ])

    if (confRes.error || dykmRes.error) {
      console.error('Error fetching unread counts:', confRes.error || dykmRes.error)
      return
    }

    setUnreadCount((confRes.count || 0) + (dykmRes.count || 0))
    setUnreadMessagesCount(confRes.count || 0)
  }, [profileId, supabase])

  useEffect(() => {
    if (!profileId) {
      setUnreadCount(0)
      return
    }

    refreshUnreadCount()

    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, () => {
        refreshUnreadCount()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dykm_scores',
        filter: `quiz_owner_id=eq.${profileId}`
      }, () => {
        refreshUnreadCount()
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [profileId, refreshUnreadCount])

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      unreadMessagesCount,
      setUnreadCount,
      setUnreadMessagesCount,
      refreshUnreadCount
    }}>
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
