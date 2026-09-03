'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logDebug(message: string, data?: unknown) {
  console.log(`[notif-debug] ${message}`, data !== undefined ? JSON.stringify(data) : '')
}

export type NotificationType =
  | 'message'
  | 'dykm'
  | 'lobby'
  | 'xp'
  | 'hot_seat'
  | 'tod_turn'
  | 'friend_request'
  | 'friend_request_response'
  | 'lobby_join_response'
  | 'hot_seat_answer'
  | 'game_invite'
  | 'three_word'

const NOTIFICATION_READS_TYPES: NotificationType[] = [
  'lobby',
  'friend_request',
  'friend_request_response',
  'lobby_join_response',
  'hot_seat_answer',
]

// 'lobby' (tod_messages system events) belongs here — app/notifications/page.tsx
// already filters lobby events against hidden_notifications keyed by type 'lobby'
// (see `filteredLobbyEvents`), and the client's delete handler already has a
// rollback branch for it. It was just missing from this list, which meant every
// attempt to delete a lobby notification called deleteNotification, silently hit
// the "can't be deleted" branch below, and got rolled back with an error toast.
const DELETABLE_TYPES: NotificationType[] = [
  'message', 'dykm', 'xp', 'hot_seat', 'tod_turn', 'game_invite',
  'friend_request', 'friend_request_response', 'three_word', 'lobby'
]

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
  lobby: 'lobby',
}

function notificationTypeKey(type: NotificationType): string {
  return NOTIFICATION_TYPE_KEY[type] || type
}

export async function deleteNotification(id: string, type: NotificationType) {
  const supabase = await createSupabaseServerClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    if (!DELETABLE_TYPES.includes(type)) {
      throw new Error(`Notifications of type "${type}" can't be deleted directly — they resolve on their own.`)
    }

    // FIX: Game invites aren't part of the hidden_notifications check constraint.
    // So we just delete the actual invite directly.
    if (type === 'game_invite') {
      const { error } = await supabase
        .from('game_invites')
        .delete()
        .eq('id', id)
        .eq('invitee_id', user.id)

      if (error) throw error
    } else {
      const notificationType = notificationTypeKey(type)
      
      const { error } = await supabase
        .from('hidden_notifications')
        .upsert({
          user_id: user.id,
          notification_id: id,
          notification_type: notificationType
        }, { onConflict: 'user_id, notification_id, notification_type' })

      if (error) throw error
    }

    revalidatePath('/notifications')
    return { success: true }
  } catch (error: any) {
    console.error('Server Action Error (deleteNotification):', error)
    const message = error?.message || error?.details || (typeof error === 'string' ? error : 'Unknown error')
    return { success: false, error: message }
  }
}

export const hideNotification = deleteNotification

export async function markNotificationAsRead(id: string, type: NotificationType) {
  const supabase = await createSupabaseServerClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    if (NOTIFICATION_READS_TYPES.includes(type)) {
      await supabase
        .from('notification_reads')
        .upsert({
          user_id: user.id,
          notification_id: id,
          notification_type: type
        }, { onConflict: 'user_id, notification_id, notification_type' })
    } else {
      switch (type) {
        case 'message':
          await supabase.from('confessions').update({ is_read: true }).eq('id', id).eq('profile_id', user.id)
          break
        case 'dykm':
          await supabase.from('dykm_scores').update({ is_read: true }).eq('id', id).eq('quiz_owner_id', user.id)
          break
        case 'xp':
          await supabase.from('xp_transactions').update({ is_read: true }).eq('id', id).eq('user_id', user.id)
          break
        case 'hot_seat':
          await supabase.from('hot_seat_questions').update({ is_read: true }).eq('id', id)
          break
        case 'tod_turn':
          await supabase.from('tod_turn_events').update({ is_read: true }).eq('id', id).eq('user_id', user.id)
          break
        case 'game_invite':
          await supabase.from('game_invites').update({ is_read: true }).eq('id', id).eq('invitee_id', user.id)
          break
        case 'three_word':
          await supabase.from('three_word_responses').update({ is_read: true }).eq('id', id).eq('host_id', user.id)
          break
      }
    }

    revalidatePath('/notifications')
    return { success: true }
  } catch (error) {
    console.error('Server Action Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function markAllNotificationsAsRead() {
  const supabase = await createSupabaseServerClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Each step below is fault-isolated: previously these were bare sequential
    // awaits under one try/catch, so a single failing table (e.g. an RLS hiccup
    // on one update) threw immediately and skipped every step after it, even
    // though those steps are otherwise independent of each other. That silent
    // truncation was worse than "partial" — everything from the failure point
    // onward simply never ran. `failedSteps` collects what actually failed so
    // the caller (and the client's rollback logic) can react honestly instead
    // of assuming a clean success. This is still not a single atomic DB
    // transaction — a true all-or-nothing guarantee would need a Postgres RPC —
    // but it stops one failure from masking every other step's outcome.
    const failedSteps: string[] = []
    // fn is typed as PromiseLike, not Promise: Supabase's query builder
    // (e.g. `supabase.from(...).update(...)`) is a "thenable" — it has
    // `.then()` so `await` works fine on it at runtime — but it isn't a
    // real Promise (no `.catch`/`.finally`/Symbol.toStringTag), which is
    // exactly what broke the Vercel build (TS2345) on the simple one-line
    // steps below that return the builder directly instead of an
    // async-wrapped Promise.
    const step = async (label: string, fn: () => PromiseLike<{ error: any } | void>) => {
      try {
        const result = await fn()
        if (result && (result as any).error) {
          console.error(`Server Action Error (markAllNotificationsAsRead:${label}):`, (result as any).error)
          failedSteps.push(label)
        }
      } catch (err) {
        console.error(`Server Action Error (markAllNotificationsAsRead:${label}):`, err)
        failedSteps.push(label)
      }
    }

    await step('confessions', () =>
      supabase.from('confessions').update({ is_read: true }).eq('profile_id', user.id).eq('is_read', false)
    )
    await step('dykm_scores', () =>
      supabase.from('dykm_scores').update({ is_read: true }).eq('quiz_owner_id', user.id).eq('is_read', false)
    )
    await step('xp_transactions', () =>
      supabase.from('xp_transactions').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    )
    await step('three_word_responses', () =>
      supabase.from('three_word_responses').update({ is_read: true }).eq('host_id', user.id).eq('is_read', false)
    )

    await step('hot_seat_questions', async () => {
      // Intentionally across ALL hosted sessions, not just `status: 'active'` ones —
      // refreshUnreadCount (context/NotificationContext.tsx) counts unread hot seat
      // questions across every hosted session regardless of status, so filtering to
      // active-only here left questions from ended sessions permanently unread: the
      // badge counted them but this could never clear them. Keep both in sync.
      const { data: sessions, error: sessionsError } = await supabase
        .from('hot_seat_sessions')
        .select('id')
        .eq('host_id', user.id)

      if (sessionsError) return { error: sessionsError }

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id)
        const { error } = await supabase
          .from('hot_seat_questions')
          .update({ is_read: true })
          .in('session_id', sessionIds)
          .eq('is_read', false)
        if (error) return { error }
      }
    })

    await step('tod_turn_events', () =>
      supabase.from('tod_turn_events').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    )
    await step('game_invites', () =>
      supabase.from('game_invites').update({ is_read: true }).eq('invitee_id', user.id).eq('is_read', false)
    )

    await step('lobby_events', async () => {
      const { data: joinedLobbies, error: joinedError } = await supabase
        .from('tod_participants')
        .select('lobby_id')
        .eq('user_id', user.id)
        .eq('status', 'joined')

      if (joinedError) return { error: joinedError }

      if (joinedLobbies && joinedLobbies.length > 0) {
        const lobbyIds = joinedLobbies.map(l => l.lobby_id)
        const { data: events, error: eventsError } = await supabase
          .from('tod_messages')
          .select('id')
          .in('lobby_id', lobbyIds)
          .eq('message_type', 'system')
          .limit(100)

        if (eventsError) return { error: eventsError }

        if (events && events.length > 0) {
          const { error } = await supabase
            .from('notification_reads')
            .upsert(
              events.map(e => ({ user_id: user.id, notification_id: e.id, notification_type: 'lobby' })),
              { onConflict: 'user_id, notification_id, notification_type' }
            )
          if (error) return { error }
        }
      }
    })

    await step('friend_requests', async () => {
      const { data: friendRequests, error: frError } = await supabase
        .from('friendships')
        .select('id')
        .eq('addressee_id', user.id)
        .eq('status', 'pending')

      if (frError) return { error: frError }

      if (friendRequests && friendRequests.length > 0) {
        const { error } = await supabase
          .from('notification_reads')
          .upsert(
            friendRequests.map(fr => ({ user_id: user.id, notification_id: fr.id, notification_type: 'friend_request' })),
            { onConflict: 'user_id, notification_id, notification_type' }
          )
        if (error) return { error }
      }
    })

    await step('friend_responses', async () => {
      const { data: friendResponses, error: frRespError } = await supabase
        .from('friendships')
        .select('id')
        .eq('requester_id', user.id)
        .in('status', ['accepted', 'declined'])

      if (frRespError) return { error: frRespError }

      if (friendResponses && friendResponses.length > 0) {
        const { error } = await supabase
          .from('notification_reads')
          .upsert(
            friendResponses.map(fr => ({ user_id: user.id, notification_id: fr.id, notification_type: 'friend_request_response' })),
            { onConflict: 'user_id, notification_id, notification_type' }
          )
        if (error) return { error }
      }
    })

    await step('lobby_join_responses', async () => {
      const { data: lobbyResponses, error: lobbyRespError } = await supabase
        .from('tod_participants')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['rejected', 'banned'])

      if (lobbyRespError) return { error: lobbyRespError }

      if (lobbyResponses && lobbyResponses.length > 0) {
        const { error } = await supabase
          .from('notification_reads')
          .upsert(
            lobbyResponses.map(p => ({ user_id: user.id, notification_id: p.id, notification_type: 'lobby_join_response' })),
            { onConflict: 'user_id, notification_id, notification_type' }
          )
        if (error) return { error }
      }
    })

    await step('hot_seat_answers', async () => {
      const { data: myAnsweredQuestions, error: answeredError } = await supabase
        .from('hot_seat_questions')
        .select('id')
        .eq('asker_id', user.id)
        .in('status', ['answered', 'skipped', 'timed_out'])

      if (answeredError) return { error: answeredError }

      if (myAnsweredQuestions && myAnsweredQuestions.length > 0) {
        const { error } = await supabase
          .from('notification_reads')
          .upsert(
            myAnsweredQuestions.map(q => ({ user_id: user.id, notification_id: q.id, notification_type: 'hot_seat_answer' })),
            { onConflict: 'user_id, notification_id, notification_type' }
          )
        if (error) return { error }
      }
    })

    revalidatePath('/notifications')

    if (failedSteps.length > 0) {
      return { success: false, error: `Some notifications couldn't be marked as read (${failedSteps.join(', ')})`, failedSteps }
    }
    return { success: true }
  } catch (error) {
    console.error('Server Action Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
