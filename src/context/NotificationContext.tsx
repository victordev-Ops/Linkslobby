'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { showAppToast } from '@/components/AppToast'
import {
  MessageSquare, Trophy, Dices, Ban, UserPlus, UserCheck,
  Flame, Gamepad2, Type,
} from 'lucide-react'
import { logDebug } from '@/actions/notifications'

type NotificationContextType = {
  unreadCount: number
  unreadMessagesCount: number
  friendRequestCount: number
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>
  setUnreadMessagesCount: React.Dispatch<React.SetStateAction<number>>
  setFriendRequestCount: React.Dispatch<React.SetStateAction<number>>
  refreshUnreadCount: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// Mirrors NOTIFICATION_TYPE_KEY in actions/notifications.ts — kept as a duplicate here
// because that file has 'use server' at the top, so nothing non-async can be exported
// from it and imported here. If you add a new deletable notification type, update both.
const NOTIFICATION_TYPE_KEY: Record<string, string> = {
  message: 'confession',
  dykm: 'dykm_score',
  xp: 'xp_transaction',
  hot_seat: 'hot_seat_question',
  tod_turn: 'tod_turn_event',
  game_invite: 'game_invite',
  friend_request: 'friend_request',
  friend_request_response: 'friend_request_response',
  three_word: 'three_word_response',
}

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
  const [friendRequestCount, setFriendRequestCount] = useState(0)
  const [hostedSessionIds, setHostedSessionIds] = useState<string[]>([])
  const [userSessionIds, setUserSessionIds] = useState<string[]>([])
  // Refs mirroring the two state values above. The channel effect reads from these
  // instead of depending on the state directly — otherwise, every time either array
  // resolves from its initial `[]` to real data, the effect below tears down and
  // recreates the whole realtime channel (including the message/confessions listener),
  // and any event arriving during that gap is silently lost.
  const hostedSessionIdsRef = useRef<string[]>([])
  const userSessionIdsRef = useRef<string[]>([])
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
        hostedSessionIdsRef.current = data.map(s => s.id)
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
        userSessionIdsRef.current = data.map(s => s.session_id)
      }
    }
    fetchUserSessions()
  }, [profileId, supabase])

  // ─── Optimized refresh ───
  const refreshUnreadCount = useCallback(async () => {
    if (!profileId) {
      setUnreadCount(0)
      setUnreadMessagesCount(0)
      setFriendRequestCount(0)
      return
    }

    const [
      confRes, dykmRes, xpRes, hotSeatRes, hiddenRes, chatUnreadRes,
      turnRes, gameInviteRes, threeWordRes, friendReqRes, friendRespRes, lobbyRespRes, hotSeatAnsRes, readsRes
    ] = await Promise.all([
      // NOTE: we no longer filter these by their own `is_hidden` columns here —
      // deletion from the notification feed is tracked in ONE place
      // (`hidden_notifications`) and applied uniformly below, via hiddenIds.
      // Fetching ids (not a head-count) so we can subtract hidden ones in JS.
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
      supabase
        .from('hidden_notifications')
        .select('notification_id, notification_type')
        .eq('user_id', profileId),
      supabase
        .from('chat_participants')
        .select('session_id, last_read_at')
        .eq('user_id', profileId),
      // Lobby turn events (own is_read column)
      supabase
        .from('tod_turn_events')
        .select('id')
        .eq('user_id', profileId)
        .eq('is_read', false),
      // Game invites — previously never counted here at all, so the bell badge
      // silently under-counted these.
      supabase
        .from('game_invites')
        .select('id')
        .eq('invitee_id', profileId)
        .eq('is_read', false),
      // Three Word Game responses (host view) — same as confessions/dykm,
      // never counted before this table existed.
      supabase
        .from('three_word_responses')
        .select('id')
        .eq('host_id', profileId)
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
      // notification_reads — needed to filter the "virtual" types down to unread only
      supabase
        .from('notification_reads')
        .select('notification_id, notification_type')
        .eq('user_id', profileId),
    ])

    // Surface errors instead of silently treating a failed query the same as "no rows" —
    // an RLS or permissions error here would otherwise look identical to "nothing unread".
    const namedResults: [string, any][] = [
      ['confessions', confRes], ['dykm_scores', dykmRes], ['xp_transactions', xpRes],
      ['hot_seat_questions', hotSeatRes], ['hidden_notifications', hiddenRes],
      ['tod_turn_events', turnRes], ['game_invites', gameInviteRes],
      ['three_word_responses', threeWordRes],
      ['friendships(pending)', friendReqRes], ['friendships(accepted)', friendRespRes],
      ['tod_participants', lobbyRespRes], ['hot_seat_questions(asker)', hotSeatAnsRes],
      ['notification_reads', readsRes],
    ]
    for (const [name, res] of namedResults) {
      if (res.error) {
        console.error(`[refreshUnreadCount] query failed: ${name}`, res.error)
        logDebug(`query failed: ${name}`, res.error?.message || res.error)
      }
    }

    // Keyed as `${notification_type}:${notification_id}` — matching the keys written by
    // deleteNotification (see NOTIFICATION_TYPE_KEY above, mirrored in actions/notifications.ts)
    // so a deleted notification is excluded from the count no matter which table it came from.
    const hiddenIds = new Set(
      (hiddenRes.data || []).map(h => `${h.notification_type}:${h.notification_id}`)
    )
    const readIds = new Set((readsRes.data || []).map(r => `${r.notification_type}:${r.notification_id}`))

    const confessionsCount = (confRes.data || []).filter(r => !hiddenIds.has(`${NOTIFICATION_TYPE_KEY.message}:${r.id}`)).length
    const dykmCount = (dykmRes.data || []).filter(r => !hiddenIds.has(`${NOTIFICATION_TYPE_KEY.dykm}:${r.id}`)).length
    const xpCount = (xpRes.data || []).filter(r => !hiddenIds.has(`${NOTIFICATION_TYPE_KEY.xp}:${r.id}`)).length
    const hotSeatCount = (hotSeatRes.data || []).filter(r => !hiddenIds.has(`${NOTIFICATION_TYPE_KEY.hot_seat}:${r.id}`)).length
    const turnCount = (turnRes.data || []).filter(r => !hiddenIds.has(`${NOTIFICATION_TYPE_KEY.tod_turn}:${r.id}`)).length
    const gameInviteCount = (gameInviteRes.data || []).filter(r => !hiddenIds.has(`${NOTIFICATION_TYPE_KEY.game_invite}:${r.id}`)).length
    const threeWordCount = (threeWordRes.data || []).filter(r => !hiddenIds.has(`${NOTIFICATION_TYPE_KEY.three_word}:${r.id}`)).length

    const friendReqCount = (friendReqRes.data || []).filter(r =>
      !readIds.has(`friend_request:${r.id}`) && !hiddenIds.has(`${NOTIFICATION_TYPE_KEY.friend_request}:${r.id}`)
    ).length
    const friendRespCount = (friendRespRes.data || []).filter(r =>
      !readIds.has(`friend_request_response:${r.id}`) && !hiddenIds.has(`${NOTIFICATION_TYPE_KEY.friend_request_response}:${r.id}`)
    ).length
    const lobbyRespCount = (lobbyRespRes.data || []).filter(r => !readIds.has(`lobby_join_response:${r.id}`)).length
    const hotSeatAnsCount = (hotSeatAnsRes.data || []).filter(r => !readIds.has(`hot_seat_answer:${r.id}`)).length

    setUnreadCount(
      confessionsCount + dykmCount + xpCount + hotSeatCount + turnCount + gameInviteCount +
      friendReqCount + friendRespCount + lobbyRespCount + hotSeatAnsCount + threeWordCount
    )
    logDebug('refreshUnreadCount computed', {
      confessionsCount, dykmCount, xpCount, hotSeatCount, turnCount, gameInviteCount,
      friendReqCount, friendRespCount, lobbyRespCount, hotSeatAnsCount, threeWordCount
    })
    // Profile nav badge — pending friend requests specifically, not lumped
    // in with everything else on the bell.
    setFriendRequestCount(friendReqCount)

    // Chat unread — count sessions with at least one incoming (not self-sent) message
    // newer than the user's last_read_at for that session.
    //
    // Previously this compared chat_sessions.updated_at against last_read_at, but that
    // field isn't reliably bumped when a new chat_message is inserted (no trigger keeps
    // it in sync), so it silently never registered new messages as unread, and it also
    // didn't distinguish your own messages (which shouldn't count as unread) from
    // incoming ones. Querying chat_messages directly removes both problems.
    let chatUnreadTotal = 0
    if (chatUnreadRes.error) {
      console.error('[refreshUnreadCount] query failed: chat_participants', chatUnreadRes.error)
      logDebug('query failed: chat_participants', chatUnreadRes.error?.message || chatUnreadRes.error)
    }
    if (chatUnreadRes.data && chatUnreadRes.data.length > 0) {
      const sessions = chatUnreadRes.data
      const sessionIds = sessions.map((s: any) => s.session_id)

      const { data: incomingMessages, error: incomingMsgError } = await supabase
        .from('chat_messages')
        .select('session_id, created_at')
        .in('session_id', sessionIds)
        .neq('sender_id', profileId)

      if (incomingMsgError) {
        console.error('[refreshUnreadCount] query failed: chat_messages', incomingMsgError)
        logDebug('query failed: chat_messages', incomingMsgError?.message || incomingMsgError)
      }

      const lastReadBySession = new Map(sessions.map((s: any) => [s.session_id, s.last_read_at]))
      const latestIncomingBySession = new Map<string, string>()
      for (const m of incomingMessages || []) {
        const current = latestIncomingBySession.get(m.session_id)
        if (!current || new Date(m.created_at) > new Date(current)) {
          latestIncomingBySession.set(m.session_id, m.created_at)
        }
      }

      for (const [sessionId, lastIncomingAt] of latestIncomingBySession) {
        const lastRead = lastReadBySession.get(sessionId)
        if (new Date(lastIncomingAt) > new Date((lastRead as string) || 0)) chatUnreadTotal++
      }

      logDebug('chat portion of unreadMessagesCount computed', {
        sessionsWithParticipation: sessionIds.length,
        incomingMessagesReturned: incomingMessages?.length ?? null,
        sessionsWithIncoming: latestIncomingBySession.size,
        chatUnreadTotal
      })
    } else {
      logDebug('chat portion of unreadMessagesCount set to 0', { chatUnreadRowCount: chatUnreadRes.data?.length ?? null })
    }

    // "Messages" badge = confessions (this single table covers plain confessions, AMA
    // questions, anonymous messages, and DMs — DMs are just confessions whose content is
    // prefixed with "[DM:...]", there's no separate table for them) PLUS unread live chat.
    // confessionsCount already excludes anything the user deleted from their feed
    // (hiddenIds), consistent with how it's counted for the bell above.
    const messagesTotal = confessionsCount + chatUnreadTotal
    logDebug('unreadMessagesCount computed', { confessionsCount, chatUnreadTotal, messagesTotal })
    setUnreadMessagesCount(messagesTotal)
  }, [profileId, supabase])

  const debouncedRefresh = useDebouncedCallback(refreshUnreadCount, 500)

  useEffect(() => {
    if (!profileId) {
      setUnreadCount(0)
      setFriendRequestCount(0)
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
        if (userSessionIdsRef.current.length > 0 && !userSessionIdsRef.current.includes(msg.session_id)) {
          logDebug('chat_messages INSERT received but filtered out (session not in userSessionIdsRef)', {
            session_id: msg.session_id, knownSessions: userSessionIdsRef.current
          })
          return
        }
        logDebug('chat_messages INSERT accepted, refreshing', { session_id: msg.session_id })
        debouncedRefresh()
        showAppToast('New Message! 💬', {
          id: `chat:${msg.id}`,
          icon: MessageSquare,
          variant: 'info',
          description: msg.content?.substring(0, 50),
          action: { label: 'View', onClick: () => window.location.href = `/messages/${msg.session_id}` }
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${profileId}`
      }, () => debouncedRefresh())
      // Keep the "which sessions am I in" ref current — without this, a brand-new
      // conversation's session_id is missing from userSessionIdsRef until next full
      // page load, so its INSERT events get silently filtered out above and the
      // message notification never fires for it.
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${profileId}`
      }, (payload) => {
        const sessionId = (payload.new as any)?.session_id
        if (sessionId && !userSessionIdsRef.current.includes(sessionId)) {
          userSessionIdsRef.current = [...userSessionIdsRef.current, sessionId]
          setUserSessionIds(userSessionIdsRef.current)
        }
      })
      // Confessions
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'confessions', filter: `profile_id=eq.${profileId}`
      }, (payload) => {
        logDebug('confessions INSERT received', { id: (payload.new as any)?.id })
        debouncedRefresh()
        const msg = payload.new
        const isDM = msg.message?.startsWith('[DM:')
        let title = 'New message! 💌'
        let description = 'You received a new secret message.'
        if (isDM) { title = 'New Direct Message! 💬'; description = 'You have a new private message.' }
        else if (msg.message_type === 'ama') { title = 'New AMA Question! ❓'; description = 'Someone asked you a question!' }

        showAppToast(title, {
          id: `message:${msg.id}`,
          icon: MessageSquare,
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
        showAppToast('Quiz result! 🏆', {
          id: `dykm:${score.id}`,
          icon: Trophy,
          variant: 'warning',
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
          showAppToast('Your Turn! 🎯', {
            id: `turn:${turn.id}`,
            icon: Dices,
            description: `It's your turn to answer${lobbyName}!`,
            action: { label: 'Go to Game', onClick: () => window.location.href = `/tod/${slug}` }
          })
        } else {
          showAppToast('Your Turn to Ask! 🎲', {
            id: `turn:${turn.id}`,
            icon: Dices,
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
        showAppToast(p.status === 'banned' ? 'You were banned 🚫' : 'Request declined', {
          id: `lobby_join_response:${p.id}`,
          icon: Ban,
          variant: 'error',
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

        showAppToast('New Friend Request! 👋', {
          id: `friend_request:${fr.id}`,
          icon: UserPlus,
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

        showAppToast('Friend Request Accepted! 🤝', {
          id: `friend_request_response:${fr.id}`,
          icon: UserCheck,
          variant: 'success',
          description: `@${addressee?.username || 'Someone'} accepted your friend request!`,
          action: { label: 'View', onClick: () => window.location.href = addressee?.slug ? `/u/${addressee.slug}` : '/notifications' }
        })
      })
      // Hot Seat Questions (host — new question)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'hot_seat_questions'
      }, (payload) => {
        const q = payload.new
        if (hostedSessionIdsRef.current.includes(q.session_id)) {
          showAppToast('Hot Seat: New Question! 🔥', {
            id: `hot_seat:${q.id}`,
            icon: Flame,
            variant: 'warning',
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

        showAppToast(titles[q.status], {
          id: `hot_seat_answer:${q.id}`,
          icon: Flame,
          variant: q.status === 'answered' ? 'success' : 'default',
          description: session?.name ? `In session: ${session.name}` : undefined,
          action: { label: 'View', onClick: () => window.location.href = `/hot-seat/${session?.slug || ''}` }
        })
      })
      // Game invites (own is_read column, now counted toward the badge)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'game_invites', filter: `invitee_id=eq.${profileId}`
      }, (payload: any) => {
        debouncedRefresh()
        if (payload.eventType === 'INSERT') {
          const inv = payload.new
          showAppToast('Game Invite! 🎮', {
            id: `game_invite:${inv.id}`,
            icon: Gamepad2,
            description: `${inv.game_label || 'A game'} invite is waiting for you.`,
            action: { label: 'View', onClick: () => window.location.href = '/notifications' }
          })
        }
      })
      // Three Word Game responses (own is_read column, host view)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'three_word_responses', filter: `host_id=eq.${profileId}`
      }, (payload: any) => {
        debouncedRefresh()
        if (payload.eventType === 'INSERT') {
          const r = payload.new
          showAppToast('Someone described you! 🔤', {
            id: `three_word:${r.id}`,
            icon: Type,
            description: `"${r.words}"`,
            action: { label: 'View', onClick: () => window.location.href = '/three-words' }
          })
        }
      })
      // Catch-all refresh triggers (debounced)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confessions', filter: `profile_id=eq.${profileId}` }, () => debouncedRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'xp_transactions', filter: `user_id=eq.${profileId}` }, () => debouncedRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hot_seat_questions' }, () => debouncedRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dykm_scores', filter: `quiz_owner_id=eq.${profileId}` }, () => debouncedRefresh())
      .subscribe((status, err) => {
        console.log(`[notifications channel] status=${status}`, err || '')
        logDebug(`channel status: ${status}`, err ? String(err) : undefined)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[notifications channel] failed to subscribe — realtime updates will not arrive until this recovers', err)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
    // Deliberately NOT depending on hostedSessionIds/userSessionIds — the handlers
    // above read the live hostedSessionIdsRef/userSessionIdsRef instead, so this
    // channel is created once per profileId and never torn down mid-session
    // (which was silently dropping realtime events, especially new messages).
  }, [profileId, refreshUnreadCount, debouncedRefresh])

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      unreadMessagesCount,
      friendRequestCount,
      setUnreadCount,
      setUnreadMessagesCount,
      setFriendRequestCount,
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
        friendRequestCount: 0,
        setUnreadCount: () => { },
        setUnreadMessagesCount: () => { },
        setFriendRequestCount: () => { },
        refreshUnreadCount: async () => { }
      }
    }
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
            }
