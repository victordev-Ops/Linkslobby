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
  // NOT 'lobby': hidden_notifications has a DB check constraint
  // (hidden_notifications_notification_type_check) allowing 'lobby_event',
  // not 'lobby'. There are already 104 historical rows using 'lobby_event'.
  // Using 'lobby' here throws a 23514 check-violation on every lobby delete
  // — confirmed in the project's postgres logs. page.tsx's isHidden() call
  // for lobby events must use the same string; see the matching fix there.
  lobby: 'lobby_event',
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

// ─── Bulk actions ─────────────────────────────────────────────────
// handleBatchDelete/handleBatchMarkRead in NotificationsClient.tsx used to fire
// one deleteNotification/markNotificationAsRead Server Action call PER selected
// item via Promise.all — selecting 30 items meant 30 separate HTTP round trips
// to Vercel, each spinning up its own function invocation and its own Supabase
// connection simultaneously, plus 30 revalidatePath calls. Under load that's a
// realistic way to exhaust the DB connection pool and make the whole batch
// action appear to hang. These collapse a batch down to 1–2 queries total by
// grouping items into single multi-row upserts / `.in()` updates, with a
// per-item fallback only on the rare path where the bulk write itself fails
// (a multi-row upsert is one atomic statement — one bad row fails all of them).

type BulkItem = { id: string; type: NotificationType }
type BulkResult = { success: boolean; failedIds: string[]; error?: string }

export async function bulkDeleteNotifications(items: BulkItem[]): Promise<BulkResult> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized', failedIds: items.map(i => i.id) }
  if (items.length === 0) return { success: true, failedIds: [] }

  const failedIds = new Set<string>()

  // Non-deletable types (lobby_join_response, hot_seat_answer) never reach the DB.
  const deletable = items.filter(i => DELETABLE_TYPES.includes(i.type))
  items.filter(i => !DELETABLE_TYPES.includes(i.type)).forEach(i => failedIds.add(i.id))

  const gameInviteItems = deletable.filter(i => i.type === 'game_invite')
  const hideItems = deletable.filter(i => i.type !== 'game_invite')

  if (gameInviteItems.length > 0) {
    const { data, error } = await supabase
      .from('game_invites')
      .delete()
      .in('id', gameInviteItems.map(i => i.id))
      .eq('invitee_id', user.id)
      .select('id')
    if (error) {
      console.error('Server Action Error (bulkDeleteNotifications:game_invites):', error)
      gameInviteItems.forEach(i => failedIds.add(i.id))
    } else {
      // .delete() silently drops ids that don't match (RLS, wrong owner, already
      // gone) instead of erroring — .select('id') tells us which actually went.
      const deletedIds = new Set((data || []).map((r: any) => r.id))
      gameInviteItems.forEach(i => { if (!deletedIds.has(i.id)) failedIds.add(i.id) })
    }
  }

  if (hideItems.length > 0) {
    const rows = hideItems.map(i => ({
      user_id: user.id,
      notification_id: i.id,
      notification_type: notificationTypeKey(i.type),
    }))
    const { error } = await supabase
      .from('hidden_notifications')
      .upsert(rows, { onConflict: 'user_id, notification_id, notification_type' })
    if (error) {
      console.error('Server Action Error (bulkDeleteNotifications:hidden_notifications):', error)
      // Fall back to one-at-a-time only on failure, so a single bad row doesn't
      // sink every other item that would otherwise have succeeded.
      for (const item of hideItems) {
        const { error: itemError } = await supabase
          .from('hidden_notifications')
          .upsert(
            { user_id: user.id, notification_id: item.id, notification_type: notificationTypeKey(item.type) },
            { onConflict: 'user_id, notification_id, notification_type' }
          )
        if (itemError) {
          console.error(`Server Action Error (bulkDeleteNotifications:${item.id}):`, itemError)
          failedIds.add(item.id)
        }
      }
    }
  }

  revalidatePath('/notifications')
  return { success: failedIds.size === 0, failedIds: Array.from(failedIds) }
}

export async function bulkMarkNotificationsAsRead(items: BulkItem[]): Promise<BulkResult> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized', failedIds: items.map(i => i.id) }
  if (items.length === 0) return { success: true, failedIds: [] }

  const failedIds = new Set<string>()

  const readsItems = items.filter(i => NOTIFICATION_READS_TYPES.includes(i.type))
  const directItems = items.filter(i => !NOTIFICATION_READS_TYPES.includes(i.type))

  if (readsItems.length > 0) {
    const rows = readsItems.map(i => ({ user_id: user.id, notification_id: i.id, notification_type: i.type }))
    const { error } = await supabase
      .from('notification_reads')
      .upsert(rows, { onConflict: 'user_id, notification_id, notification_type' })
    if (error) {
      console.error('Server Action Error (bulkMarkNotificationsAsRead:notification_reads):', error)
      for (const item of readsItems) {
        const { error: itemError } = await supabase
          .from('notification_reads')
          .upsert(
            { user_id: user.id, notification_id: item.id, notification_type: item.type },
            { onConflict: 'user_id, notification_id, notification_type' }
          )
        if (itemError) failedIds.add(item.id)
      }
    }
  }

  // Direct-column types live in different tables with different owner columns,
  // so they can't share one query — but grouping by type still turns what used
  // to be N round trips into at most 7 (one per possible type below).
  const byType = new Map<string, string[]>()
  for (const item of directItems) {
    const list = byType.get(item.type)
    if (list) list.push(item.id)
    else byType.set(item.type, [item.id])
  }

  // Typed as PromiseLike, not Promise — same reason as the `step` helper in
  // markAllNotificationsAsRead above: these return Supabase's query builder
  // directly rather than an async-wrapped Promise, and the builder is a
  // thenable but not a full Promise (no catch/finally/Symbol.toStringTag).
  // `Promise<...>` here would fail the build the exact same way TS2345 did before.
  const directUpdaters: Record<string, (ids: string[]) => PromiseLike<{ error: any }>> = {
    message: (ids) => supabase.from('confessions').update({ is_read: true }).in('id', ids).eq('profile_id', user.id),
    dykm: (ids) => supabase.from('dykm_scores').update({ is_read: true }).in('id', ids).eq('quiz_owner_id', user.id),
    xp: (ids) => supabase.from('xp_transactions').update({ is_read: true }).in('id', ids).eq('user_id', user.id),
    hot_seat: (ids) => supabase.from('hot_seat_questions').update({ is_read: true }).in('id', ids),
    tod_turn: (ids) => supabase.from('tod_turn_events').update({ is_read: true }).in('id', ids).eq('user_id', user.id),
    game_invite: (ids) => supabase.from('game_invites').update({ is_read: true }).in('id', ids).eq('invitee_id', user.id),
    three_word: (ids) => supabase.from('three_word_responses').update({ is_read: true }).in('id', ids).eq('host_id', user.id),
  }

  for (const [type, ids] of byType) {
    const updater = directUpdaters[type]
    if (!updater) { ids.forEach(id => failedIds.add(id)); continue }
    const { error } = await updater(ids)
    if (error) {
      console.error(`Server Action Error (bulkMarkNotificationsAsRead:${type}):`, error)
      ids.forEach(id => failedIds.add(id))
    }
  }

  revalidatePath('/notifications')
  return { success: failedIds.size === 0, failedIds: Array.from(failedIds) }
}
