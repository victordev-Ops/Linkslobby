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
  const [hostedSessionIds, setHostedSessionIds] = useState<string[]>([])
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // Fetch hosted sessions for Hot Seat notifications
  useEffect(() => {
    if (!profileId) return
    const fetchHostedSessions = async () => {
      const { data } = await supabase
        .from('hot_seat_sessions')
        .select('id')
        .eq('host_id', profileId)
        .eq('status', 'active') // Only care about active sessions

      if (data) {
        setHostedSessionIds(data.map(s => s.id))
      }
    }
    fetchHostedSessions()
  }, [profileId, supabase])

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
      // 1. Confessions / DMs
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, (payload) => {
        refreshUnreadCount()
        const msg = payload.new

        // Detect DM
        const isDM = msg.message.startsWith('[DM:')

        let title = 'New message! 💌'
        let description = 'You received a new secret message.'

        if (isDM) {
          title = 'New Direct Message! 💬'
          description = 'You have a new private message.'
        } else if (msg.message_type === 'ama') {
          title = 'New AMA Question! ❓'
          description = 'Someone asked you a question!'
        }

        toast(title, {
          description,
          action: {
            label: 'View',
            onClick: () => window.location.href = isDM ? `/messages/${msg.id}` : '/inbox' // Adjust link if needed
            // Actually DMs link via sender ID usually, but here we might just go to inbox or parse sender ID
            // Simple link to inbox for now as DMs show up there too or have own page
          }
        })
      })
      // 2. DYKM Scores
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
      // 3. TOD Turns (Lobby Updates)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tod_lobbies'
      }, (payload) => {
        const lobby = payload.new
        // Check if it's MY turn
        if (lobby.current_target_id === profileId) {
          toast('Your Turn! 🎯', {
            description: 'It is your turn to answer in Truth or Dare!',
            action: {
              label: 'Go to Game',
              onClick: () => window.location.href = `/tod/${lobby.slug}`
            }
          })
        } else if (lobby.current_asker_id === profileId) {
          toast('Your Turn to Ask! 🎲', {
            description: 'It is your turn to ask a question in Truth or Dare!',
            action: {
              label: 'Go to Game',
              onClick: () => window.location.href = `/tod/${lobby.slug}`
            }
          })
        }
      })
      // 4. Hot Seat Questions (for Host)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'hot_seat_questions'
      }, (payload) => {
        // payload.new has session_id. Check if we host it.
        const q = payload.new
        if (hostedSessionIds.includes(q.session_id)) {
          toast('Hot Seat: New Question! 🔥', {
            description: 'A new rapid fire question has been added!',
            action: {
              label: 'Go to Game',
              onClick: () => window.location.href = `/hot-seat` // Can't easily get slug here without fetch, just go to list
            }
          })
        }
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
  }, [profileId, refreshUnreadCount, hostedSessionIds]) // Re-sub if hosted sessions change implies we might miss some, but it's ok for now

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
