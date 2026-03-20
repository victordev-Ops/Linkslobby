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

// ─── Debounce helper ─────────────────────────────────────────────
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  return useCallback((...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args)
    }, delay)
  }, [delay]) as unknown as T
}

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
  const [userSessionIds, setUserSessionIds] = useState<string[]>([])
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
        .eq('status', 'active')

      if (data) {
        setHostedSessionIds(data.map(s => s.id))
      }
    }
    fetchHostedSessions()
  }, [profileId, supabase])

  // Fetch user's chat session IDs for scoping the chat_messages listener
  useEffect(() => {
    if (!profileId) return
    const fetchUserSessions = async () => {
      const { data } = await supabase
        .from('chat_participants')
        .select('session_id')
        .eq('user_id', profileId)

      if (data) {
        setUserSessionIds(data.map(s => s.session_id))
      }
    }
    fetchUserSessions()
  }, [profileId, supabase])

  // ─── Optimized refresh: 5 parallel queries instead of 8 ───
  // Removed: getSessions() server action call (was the heaviest)
  // Removed: separate hidden_notifications + notification_reads queries (merged into filtering)
  const refreshUnreadCount = useCallback(async () => {
    if (!profileId) {
      setUnreadCount(0)
      setUnreadMessagesCount(0)
      return
    }

    const [confRes, dykmRes, xpRes, hotSeatRes, hiddenRes, chatUnreadRes] = await Promise.all([
      supabase
        .from('confessions')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('is_read', false)
        .eq('is_hidden', false),
      supabase
        .from('dykm_scores')
        .select('id', { count: 'exact', head: true })
        .eq('quiz_owner_id', profileId)
        .eq('is_read', false),
      supabase
        .from('xp_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profileId)
        .eq('is_read', false),
      supabase
        .from('hot_seat_questions')
        .select('id, session:hot_seat_sessions!inner(host_id)', { count: 'exact', head: true })
        .eq('session.host_id', profileId)
        .eq('is_read', false),
      supabase
        .from('hidden_notifications')
        .select('notification_id')
        .eq('user_id', profileId),
      // Lightweight chat unread count — count messages in user's sessions where
      // sender != user and created_at > last_read_at, via a join
      supabase
        .from('chat_participants')
        .select('session_id, last_read_at')
        .eq('user_id', profileId),
    ])

    // Calculate notification count
    const hiddenIds = new Set((hiddenRes.data || []).map(h => h.notification_id))
    const confessionsCount = confRes.count || 0
    const dykmCount = dykmRes.count || 0
    const xpCount = xpRes.count || 0
    const hotSeatCount = hotSeatRes.count || 0

    setUnreadCount(confessionsCount + dykmCount + xpCount + hotSeatCount)

    // Calculate chat unread — lightweight: check sessions updated since last_read
    if (chatUnreadRes.data && chatUnreadRes.data.length > 0) {
      const sessions = chatUnreadRes.data
      const sessionIds = sessions.map((s: any) => s.session_id)

      // Get sessions with activity
      const { data: activeSessions } = await supabase
        .from('chat_sessions')
        .select('id, updated_at')
        .in('id', sessionIds)

      let totalUnread = 0
      if (activeSessions) {
        const sessionMap = new Map(sessions.map((s: any) => [s.session_id, s.last_read_at]))
        for (const session of activeSessions) {
          const lastRead = sessionMap.get(session.id)
          if (new Date(session.updated_at) > new Date(lastRead as string || 0)) {
            totalUnread++  // Count sessions with unreads, not individual messages
          }
        }
      }
      setUnreadMessagesCount(totalUnread)
    } else {
      setUnreadMessagesCount(0)
    }
  }, [profileId, supabase])

  // Debounced version — prevents rapid-fire refreshes from realtime events
  const debouncedRefresh = useDebouncedCallback(refreshUnreadCount, 500)

  useEffect(() => {
    if (!profileId) {
      setUnreadCount(0)
      return
    }

    refreshUnreadCount()

    const channel = supabase
      .channel(`notifications-${profileId}`)
      // Chat Messages
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, async (payload) => {
        const msg = payload.new
        if (msg.sender_id === profileId) return

        if (userSessionIds.length > 0 && !userSessionIds.includes(msg.session_id)) return

        debouncedRefresh()

        toast('New Message! 💬', {
          description: msg.content?.substring(0, 50),
          action: {
            label: 'View',
            onClick: () => window.location.href = `/messages/${msg.session_id}`
          }
        })
      })
      // Chat read updates
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${profileId}`
      }, () => {
        debouncedRefresh()
      })
      // Confessions
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, (payload) => {
        debouncedRefresh()
        const msg = payload.new
        const isDM = msg.message?.startsWith('[DM:')

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
            onClick: () => {
              if (isDM) {
                const match = msg.message?.match(/^\[DM:[a-f0-9-]+:?([^\]]*)\]/)
                const senderUsername = match ? match[1] : null
                window.location.href = senderUsername ? `/messages/${senderUsername}` : `/inbox/${msg.id}`
              } else {
                window.location.href = '/inbox'
              }
            }
          }
        })
      })
      // DYKM Scores
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dykm_scores',
        filter: `quiz_owner_id=eq.${profileId}`
      }, (payload) => {
        debouncedRefresh()
        const score = payload.new
        toast('Quiz result! 🏆', {
          description: `${score.responder_name} scored ${score.score}/${score.total_questions} on your quiz!`,
          action: {
            label: 'View',
            onClick: () => window.location.href = '/notifications'
          }
        })
      })
      // TOD Turns
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tod_lobbies'
      }, (payload) => {
        const lobby = payload.new
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
      // Hot Seat Questions
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'hot_seat_questions'
      }, (payload) => {
        const q = payload.new
        if (hostedSessionIds.includes(q.session_id)) {
          toast('Hot Seat: New Question! 🔥', {
            description: 'A new rapid fire question has been added!',
            action: {
              label: 'Go to Game',
              onClick: () => window.location.href = `/hot-seat`
            }
          })
        }
      })
      // Catch-all refresh triggers (debounced to prevent storms)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${profileId}`
      }, () => debouncedRefresh())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'xp_transactions',
        filter: `user_id=eq.${profileId}`
      }, () => debouncedRefresh())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hot_seat_questions'
      }, () => debouncedRefresh())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dykm_scores',
        filter: `quiz_owner_id=eq.${profileId}`
      }, () => debouncedRefresh())
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [profileId, refreshUnreadCount, debouncedRefresh, hostedSessionIds, userSessionIds])

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
