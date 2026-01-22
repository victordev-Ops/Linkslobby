'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

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
        event: 'INSERT',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, (payload) => {
        refreshUnreadCount()
        const msg = payload.new
        toast('New message! 💌', {
          description: msg.message_type === 'ama' ? 'Someone asked you a question!' : 'You received a new secret message.',
          action: {
            label: 'View',
            onClick: () => window.location.href = '/inbox'
          }
        })
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dykm_scores',
        filter: `quiz_owner_id=eq.${profileId}`
      }, (payload) => {
        refreshUnreadCount()
        const score = payload.new
        toast('Quiz result! 🏆', {
          description: `${score.responder_name} scored ${score.score}/${score.total_questions} on your quiz!`,
          action: {
            label: 'View',
            onClick: () => window.location.href = '/notifications'
          }
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, () => {
        refreshUnreadCount()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'dykm_scores',
        filter: `quiz_owner_id=eq.${profileId}`
      }, () => {
        refreshUnreadCount()
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, () => {
        refreshUnreadCount()
      })
      .on('postgres_changes', {
        event: 'DELETE',
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
    if (typeof window === 'undefined') {
      return {
        unreadCount: 0,
        unreadMessagesCount: 0,
        setUnreadCount: () => { },
        setUnreadMessagesCount: () => { },
        refreshUnreadCount: async () => { }
      }
    }
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
