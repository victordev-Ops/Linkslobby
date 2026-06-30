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

  // ─── Optimized refresh ───
  const refreshUnreadCount = useCallback(async () => {
    if (!profileId) {
      setUnreadCount(0)
      setUnreadMessagesCount(0)
      return
    }

    const [
      confRes, dykmRes, xpRes, hotSeatRes, hiddenRes, chatUnreadRes,
      turnRes, friendReqRes, friendRespRes, lobbyRespRes, hotSeatAnsRes, readsRes
    ] = await Promise.all([
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
      supabase
        .from('chat_participants')
        .select('session_id, last_read_at')
        .eq('user_id', profileId),
      // Lobby turn events (own is_read column)
      supabase
        .from('tod_turn_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profileId)
        .eq('is_read', false),
      // Friend requests (incoming, pending)
      supabase
        .from('friendships')
        .select('id')
        .eq('addressee_id', profileId)
        .eq('status', 'pending'),
      // Friend request responses (I'm requester, accepted — declines are deleted, unobservable)
      supabase
        .from('friendships')
        .select('id')
        .eq('requester_id', profileId)
        .eq('status', 'accepted'),
      // Lobby join responses (my participant status rejected/banned)
      supabase
        .from('tod_participants')
        .select('id')
        .eq('user_id', profileId)
        .in('status', ['rejected', 'banned']),
      // Hot Seat answers (I'm asker, question resolved)
      supabase
        .from('hot_seat_questions')
        .select('id')
        .eq('asker_id', profileId)
        .in('status', ['answered', 'skipped', 'timed_out']),
      // notification_reads — needed to filter the above 4 "virtual" types down to unread only
      supabase
        .from('notification_reads')
        .select('notification_id, notification_type')
        .eq('user_id', profileId),
    ])

    const hiddenIds = new Set((hiddenRes.data || []).map(h => h.notification_id))
    const readIds = new Set((readsRes.data || []).map(r => `${r.notification_type}:${r.notification_id}`))

    const confessionsCount = confRes.count || 0
    const dykmCount = dykmRes.count || 0
    const xpCount = xpRes.count || 0
    const hotSeatCount = hotSeatRes.count || 0
    const turnCount = turnRes.count || 0

    const friendReqCount = (friendReqRes.data || []).filter(r => !readIds.has(`friend_request:${r.id}`)).length
    const friendRespCount = (friendRespRes.data || []).filter(r => !readIds.has(`friend_request_response:${r.id}`)).length
    const lobbyRespCount = (lobbyRespRes.data || []).filter(r => !readIds.has(`lobby_join_response:${r.id}`)).length
    const hotSeatAnsCount = (hotSeatAnsRes.data || []).filter(r => !readIds.has(`hot_seat_answer:${r.id}`)).length

    setUnreadCount(
      confessionsCount + dykmCount + xpCount + hotSeatCount + turnCount +
      friendReqCount + friendRespCount + lobbyRespCount + hotSeatAnsCount
    )

    // Chat unread (unchanged)
    if (chatUnreadRes.data && chatUnreadRes.data.length > 0) {
      const sessions = chatUnreadRes.data
      const sessionIds = sessions.map((s: any) => s.session_id)

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
            totalUnread++
          }
        }
      }
      setUnreadMessagesCount(totalUnread)
    } else {
      setUnreadMessagesCount(0)
    }
  }, [profileId, supabase])

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
        event: 'INSERT', schema: 'public', table: 'chat_messages'
      }, async (payload) => {
        const msg = payload.new
        if (msg.sender_id === profileId) return
        if (userSessionIds.length > 0 && !userSessionIds.includes(msg.session_id)) return
        debouncedRefresh()
        toast('New Message! 💬', {
          description: msg.content?.substring(0, 50),
          action: { label: 'View', onClick: () => window.location.href = `/messages/${msg.session_id}` }
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${profileId}`
      }, () => debouncedRefresh())
      // Confessions
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'confessions', filter: `profile_id=eq.${profileId}`
      }, (payload) => {
        debouncedRefresh()
        const msg = payload.new
        const isDM = msg.message?.startsWith('[DM:')
        let title = 'New message! 💌'
        let description = 'You received a new secret message.'
        if (isDM) { title = 'New Direct Message! 💬'; description = 'You have a new private message.' }
        else if (msg.message_type === 'ama') { title = 'New AMA Question! ❓'; description = 'Someone asked you a question!' }

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
        event: 'INSERT', schema: 'public', table: 'dykm_scores', filter: `quiz_owner_id=eq.${profileId}`
      }, (payload) => {
        debouncedRefresh()
        const score = payload.new
        toast('Quiz result! 🏆', {
          description: `${score.responder_name} scored ${score.score}/${score.total_questions} on your quiz!`,
          action: { label: 'View', onClick: () => window.location.href = '/notifications' }
        })
      })
      // Lobby turns — now sourced from tod_turn_events, not tod_lobbies UPDATE directly
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'tod_turn_events', filter: `user_id=eq.${profileId}`
      }, async (payload) => {
        const turn = payload.new
        debouncedRefresh()

        const { data: lobby } = await supabase
          .from('tod_lobbies')
          .select('slug, name')
          .eq('id', turn.lobby_id)
          .single()

        const lobbyName = lobby?.name ? ` in ${lobby.name}` : ''
        const slug = lobby?.slug

        if (turn.role === 'target') {
          toast('Your Turn! 🎯', {
            description: `It's your turn to answer${lobbyName}!`,
            action: { label: 'Go to Game', onClick: () => window.location.href = `/tod/${slug}` }
          })
        } else {
          toast('Your Turn to Ask! 🎲', {
            description: `It's your turn to ask${lobbyName}!`,
            action: { label: 'Go to Game', onClick: () => window.location.href = `/tod/${slug}` }
          })
        }
      })
      // Lobby join responses
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tod_participants', filter: `user_id=eq.${profileId}`
      }, async (payload) => {
        const p = payload.new
        if (p.status !== 'rejected' && p.status !== 'banned') return
        debouncedRefresh()

        const { data: lobby } = await supabase
          .from('tod_lobbies')
          .select('slug, name')
          .eq('id', p.lobby_id)
          .single()

        const lobbyName = lobby?.name || 'the lobby'
        toast(p.status === 'banned' ? 'You were banned 🚫' : 'Request declined', {
          description: p.status === 'banned'
            ? `You've been banned from ${lobbyName}.`
            : `Your request to join ${lobbyName} was declined.`,
        })
      })
      // Friend requests (incoming)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${profileId}`
      }, async (payload) => {
        const fr = payload.new
        if (fr.status !== 'pending') return
        debouncedRefresh()

        const { data: requester } = await supabase
          .from('profiles')
          .select('username, slug')
          .eq('id', fr.requester_id)
          .single()

        toast('New Friend Request! 👋', {
          description: `@${requester?.username || 'Someone'} wants to be friends.`,
          action: { label: 'View', onClick: () => window.location.href = requester?.slug ? `/u/${requester.slug}` : '/notifications' }
        })
      })
      // Friend request responses (I'm requester, accepted)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'friendships', filter: `requester_id=eq.${profileId}`
      }, async (payload) => {
        const fr = payload.new
        if (fr.status !== 'accepted') return
        debouncedRefresh()

        const { data: addressee } = await supabase
          .from('profiles')
          .select('username, slug')
          .eq('id', fr.addressee_id)
          .single()

        toast('Friend Request Accepted! 🤝', {
          description: `@${addressee?.username || 'Someone'} accepted your friend request!`,
          action: { label: 'View', onClick: () => window.location.href = addressee?.slug ? `/u/${addressee.slug}` : '/notifications' }
        })
      })
      // Hot Seat Questions (host — new question)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'hot_seat_questions'
      }, (payload) => {
        const q = payload.new
        if (hostedSessionIds.includes(q.session_id)) {
          toast('Hot Seat: New Question! 🔥', {
            description: 'A new rapid fire question has been added!',
            action: { label: 'Go to Game', onClick: () => window.location.href = `/hot-seat` }
          })
        }
      })
      // Hot Seat answers (asker — question resolved)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'hot_seat_questions'
      }, async (payload) => {
        const q = payload.new
        if (q.asker_id !== profileId) return
        if (!['answered', 'skipped', 'timed_out'].includes(q.status)) return
        debouncedRefresh()

        const { data: session } = await supabase
          .from('hot_seat_sessions')
          .select('slug, name')
          .eq('id', q.session_id)
          .single()

        const titles: Record<string, string> = {
          answered: 'Your Question Was Answered! 🔥',
          skipped: 'Your Question Was Skipped',
          timed_out: 'Your Question Timed Out'
        }

        toast(titles[q.status], {
          description: session?.name ? `In session: ${session.name}` : undefined,
          action: { label: 'View', onClick: () => window.location.href = `/hot-seat/${session?.slug || ''}` }
        })
      })
      // Catch-all refresh triggers (debounced)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confessions', filter: `profile_id=eq.${profileId}` }, () => debouncedRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'xp_transactions', filter: `user_id=eq.${profileId}` }, () => debouncedRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hot_seat_questions' }, () => debouncedRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dykm_scores', filter: `quiz_owner_id=eq.${profileId}` }, () => debouncedRefresh())
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
