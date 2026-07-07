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

const NOTIFICATION_READS_TYPES: NotificationType[] = [
  'lobby',
  'friend_request',
  'friend_request_response',
  'lobby_join_response',
  'hot_seat_answer',
]

const DELETABLE_TYPES: NotificationType[] = [
  'message', 'dykm', 'xp', 'hot_seat', 'tod_turn', 'game_invite',
  'friend_request', 'friend_request_response'
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

    await supabase.from('confessions').update({ is_read: true }).eq('profile_id', user.id).eq('is_read', false)
    await supabase.from('dykm_scores').update({ is_read: true }).eq('quiz_owner_id', user.id).eq('is_read', false)
    await supabase.from('xp_transactions').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)

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

    await supabase.from('tod_turn_events').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    await supabase.from('game_invites').update({ is_read: true }).eq('invitee_id', user.id).eq('is_read', false)

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
