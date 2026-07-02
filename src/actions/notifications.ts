'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

// Types that live in notification_reads (no dedicated is_read column on the source table)
const NOTIFICATION_READS_TYPES: NotificationType[] = [
  'lobby',
  'friend_request',
  'friend_request_response',
  'lobby_join_response',
  'hot_seat_answer',
]

export async function hideNotification(id: string, type: NotificationType) {
  const supabase = await createSupabaseServerClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const typeMap: Record<string, string> = {
      message: 'confession',
      dykm: 'dykm_score',
      xp: 'xp_transaction',
      hot_seat: 'hot_seat_question',
      tod_turn: 'tod_turn_event',
      // game_invite has no mapping — it falls through to itself below.
      // If hidden_notifications has a CHECK constraint on notification_type,
      // make sure 'game_invite' is added to the allowed list.
    }
    const notificationType = typeMap[type] || type

    const { error } = await supabase
      .from('hidden_notifications')
      .upsert({
        user_id: user.id,
        notification_id: id,
        notification_type: notificationType
      }, { onConflict: 'user_id, notification_id, notification_type' })

    if (error) throw error

    revalidatePath('/notifications')
    return { success: true }
  } catch (error: any) {
    console.error('Server Action Error (hideNotification):', error)
    const message = error?.message || error?.details || (typeof error === 'string' ? error : 'Unknown error')
    return { success: false, error: message }
  }
}

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

    // 1. Confessions
    await supabase.from('confessions').update({ is_read: true }).eq('profile_id', user.id).eq('is_read', false)

    // 2. DYKM scores
    await supabase.from('dykm_scores').update({ is_read: true }).eq('quiz_owner_id', user.id).eq('is_read', false)

    // 3. XP transactions
    await supabase.from('xp_transactions').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)

    // 4. Hot Seat questions (host view — "new question asked")
    const { data: sessions } = await supabase
      .from('hot_seat_sessions')
      .select('id')
      .eq('host_id', user.id)
      .eq('status', 'active')

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id)
      await supabase
        .from('hot_seat_questions')
        .update({ is_read: true })
        .in('session_id', sessionIds)
        .eq('is_read', false)
    }

    // 5. Lobby turn events (own is_read column)
    await supabase
      .from('tod_turn_events')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    // 5b. Game invites (own is_read column)
    await supabase
      .from('game_invites')
      .update({ is_read: true })
      .eq('invitee_id', user.id)
      .eq('is_read', false)

    // 6. Legacy lobby system messages (tod_messages, type='lobby')
    const { data: joinedLobbies } = await supabase
      .from('tod_participants')
      .select('lobby_id')
      .eq('user_id', user.id)
      .eq('status', 'joined')

    if (joinedLobbies && joinedLobbies.length > 0) {
      const lobbyIds = joinedLobbies.map(l => l.lobby_id)
      const { data: events } = await supabase
        .from('tod_messages')
        .select('id')
        .in('lobby_id', lobbyIds)
        .eq('message_type', 'system')
        .limit(100)

      if (events && events.length > 0) {
        await supabase
          .from('notification_reads')
          .upsert(
            events.map(e => ({ user_id: user.id, notification_id: e.id, notification_type: 'lobby' })),
            { onConflict: 'user_id, notification_id, notification_type' }
          )
      }
    }

    // 7. Friend requests (incoming, pending)
    const { data: friendRequests } = await supabase
      .from('friendships')
      .select('id')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')

    if (friendRequests && friendRequests.length > 0) {
      await supabase
        .from('notification_reads')
        .upsert(
          friendRequests.map(fr => ({ user_id: user.id, notification_id: fr.id, notification_type: 'friend_request' })),
          { onConflict: 'user_id, notification_id, notification_type' }
        )
    }

    // 8. Friend request responses (I'm the requester, status resolved)
    // Note: declined requests are deleted by declineFriendRequest, not status-flipped —
    // so in practice this only ever catches 'accepted'. Kept as 'in' for forward-compat
    // in case that delete-on-decline behavior changes later.
    const { data: friendResponses } = await supabase
      .from('friendships')
      .select('id')
      .eq('requester_id', user.id)
      .in('status', ['accepted', 'declined'])

    if (friendResponses && friendResponses.length > 0) {
      await supabase
        .from('notification_reads')
        .upsert(
          friendResponses.map(fr => ({ user_id: user.id, notification_id: fr.id, notification_type: 'friend_request_response' })),
          { onConflict: 'user_id, notification_id, notification_type' }
        )
    }

    // 9. Lobby join responses (my participant status was rejected or banned)
    const { data: lobbyResponses } = await supabase
      .from('tod_participants')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['rejected', 'banned'])

    if (lobbyResponses && lobbyResponses.length > 0) {
      await supabase
        .from('notification_reads')
        .upsert(
          lobbyResponses.map(p => ({ user_id: user.id, notification_id: p.id, notification_type: 'lobby_join_response' })),
          { onConflict: 'user_id, notification_id, notification_type' }
        )
    }

    // 10. Hot Seat answers (I'm the asker, my question got resolved)
    const { data: myAnsweredQuestions } = await supabase
      .from('hot_seat_questions')
      .select('id')
      .eq('asker_id', user.id)
      .in('status', ['answered', 'skipped', 'timed_out'])

    if (myAnsweredQuestions && myAnsweredQuestions.length > 0) {
      await supabase
        .from('notification_reads')
        .upsert(
          myAnsweredQuestions.map(q => ({ user_id: user.id, notification_id: q.id, notification_type: 'hot_seat_answer' })),
          { onConflict: 'user_id, notification_id, notification_type' }
        )
    }

    revalidatePath('/notifications')
    return { success: true }
  } catch (error) {
    console.error('Server Action Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
    }
      
