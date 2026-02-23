'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { getSessions } from '@/actions/chat'

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

    const [sessionsRes, confRes, dykmRes, xpRes, hotSeatRes, lobbyRes, hiddenRes, readRes] = await Promise.all([
      getSessions(),
      supabase
        .from('confessions')
        .select('id')
        .eq('profile_id', profileId)
        .eq('is_read', false),
      supabase
        .from('dykm_scores')
        .select('id')
        .eq('quiz_owner_id', profileId)
        .eq('is_read', false),
      supabase
        .from('xp_transactions')
        .select('id')
        .eq('user_id', profileId)
        .eq('is_read', false),
      supabase
        .from('hot_seat_questions')
        .select('id, session:hot_seat_sessions!inner(host_id)')
        .eq('session.host_id', profileId)
        .eq('is_read', false),
      // Fetch system messages from joined lobbies
      supabase
        .from('tod_participants')
        .select('lobby_id')
        .eq('user_id', profileId)
        .eq('status', 'joined')
        .then(async ({ data: parts }) => {
          if (!parts || parts.length === 0) return { data: [], error: null }
          const lIds = parts.map(p => p.lobby_id)
          return supabase
            .from('tod_messages')
            .select('id')
            .in('lobby_id', lIds)
            .eq('message_type', 'system')
        }),
      supabase
        .from('hidden_notifications')
        .select('notification_id')
        .eq('user_id', profileId),
      supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', profileId)
        .eq('notification_type', 'lobby_event')
    ])

    if (confRes.error || dykmRes.error || xpRes.error || hotSeatRes.error || (lobbyRes as any).error || hiddenRes.error || readRes.error) {
      console.error('Error fetching unread counts:', {
        confessions: confRes.error?.message,
        dykm: dykmRes.error?.message,
        xp: xpRes.error?.message,
        hotSeat: hotSeatRes.error?.message,
        lobby: (lobbyRes as any).error?.message,
        hidden: hiddenRes.error?.message,
        read: readRes.error?.message
      })
      return
    }

    const hiddenIds = new Set((hiddenRes.data || []).map(h => h.notification_id))
    const readIds = new Set((readRes.data || []).map(r => r.notification_id))

    const confessionsCount = (confRes.data || []).filter(c => !hiddenIds.has(c.id)).length
    const dykmCount = (dykmRes.data || []).filter(s => !hiddenIds.has(s.id)).length
    const xpCount = (xpRes.data || []).filter(x => !hiddenIds.has(x.id)).length
    const hotSeatCount = (hotSeatRes.data || []).filter(q => !hiddenIds.has(q.id)).length
    const lobbyCount = ((lobbyRes as any).data || []).filter((l: any) => !hiddenIds.has(l.id) && !readIds.has(l.id)).length

    const chatUnread = sessionsRes.success && sessionsRes.data
      ? (sessionsRes.data as any[]).reduce((acc, s) => acc + (s.unread_count || 0), 0)
      : 0

    // unreadCount is for the Bell icon (all except possibly chat if handled in Messages tab)
    // Actually, traditionally Notifications includes everything.
    // But if we have a separate Messages badge, we should probably separate them to avoid double badges.
    // Let's keep them separate as per BottomNavbar usage.
    setUnreadCount(confessionsCount + dykmCount + xpCount + hotSeatCount + lobbyCount)
    setUnreadMessagesCount(chatUnread)
  }, [profileId, supabase])

  useEffect(() => {
    if (!profileId) {
      setUnreadCount(0)
      return
    }

    refreshUnreadCount()

    const channel = supabase
      .channel(`notifications-${profileId}`)
      // NEW: Chat Messages
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
        // RLS will filter to only messages I can see (in my sessions)
        // But I need to filter out my own messages
      }, async (payload) => {
        const msg = payload.new
        if (msg.sender_id === profileId) return // Ignore my own messages

        refreshUnreadCount()

        // Fetch session to get sender name? Or just show "New Message"
        // Ideally we want "New Message from User"
        // fast query or generic toast
        toast('New Message! 💬', {
          description: msg.content.substring(0, 50),
          action: {
            label: 'View',
            onClick: () => window.location.href = `/messages/${msg.session_id}`
          }
        })
      })
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
            onClick: () => {
              if (isDM) {
                // Try to extract username from message metdata [DM:uuid:username]
                const match = msg.message.match(/^\[DM:[a-f0-9-]+:?([^\]]*)\]/)
                const senderUsername = match ? match[1] : null
                window.location.href = senderUsername ? `/messages/${senderUsername}` : `/inbox/${msg.id}`
              } else {
                window.location.href = '/inbox'
              }
            }
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
        table: 'xp_transactions',
        filter: `user_id=eq.${profileId}`
      }, () => {
        refreshUnreadCount()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hot_seat_questions'
      }, () => {
        // Since we can't easily filter by host_id in realtime without a view or join
        // we just refresh unread count on any question insert/update, it's efficient enough.
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
