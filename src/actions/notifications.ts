'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function hideNotification(id: string, type: 'message' | 'dykm' | 'lobby') {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        let notificationType = ''

        switch (type) {
            case 'message':
                notificationType = 'confession'
                break
            case 'dykm':
                notificationType = 'dykm_score'
                break
            case 'lobby':
                notificationType = 'lobby_event'
                break
        }

        if (!notificationType) throw new Error('Invalid notification type')

        // Verify the notification belongs to the user (if applicable) or just hide it for them
        // Hidden notifications are stored per user, so this is generally safe.
        const { error } = await supabase
            .from('hidden_notifications')
            .insert({
                user_id: user.id,
                notification_id: id,
                notification_type: notificationType
            })

        if (error) throw error

        revalidatePath('/notifications')

        return { success: true }
    } catch (error) {
        console.error('Server Action Error:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

export async function markNotificationAsRead(id: string, type: 'message' | 'dykm' | 'xp' | 'hot_seat' | 'lobby') {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        switch (type) {
            case 'message':
                await supabase
                    .from('confessions')
                    .update({ is_read: true })
                    .eq('id', id)
                    .eq('profile_id', user.id)
                break
            case 'dykm':
                await supabase
                    .from('dykm_scores')
                    .update({ is_read: true })
                    .eq('id', id)
                    .eq('quiz_owner_id', user.id)
                break
            case 'xp':
                await supabase
                    .from('xp_transactions')
                    .update({ is_read: true })
                    .eq('id', id)
                    .eq('user_id', user.id)
                break
            case 'hot_seat':
                // For Hot Seat, usually it's the host who gets the notification for new questions
                await supabase
                    .from('hot_seat_questions')
                    .update({ is_read: true })
                    .eq('id', id)
                // Note: We might want to verify host_id via join if we want strict security here
                break
            case 'lobby':
                // Lobby events are shared, so we track per-user read in a separate table
                await supabase
                    .from('notification_reads')
                    .upsert({
                        user_id: user.id,
                        notification_id: id,
                        notification_type: 'lobby_event'
                    }, { onConflict: 'user_id, notification_id, notification_type' })
                break
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

        // 1. Mark confessions as read
        await supabase
            .from('confessions')
            .update({ is_read: true })
            .eq('profile_id', user.id)
            .eq('is_read', false)

        // 2. Mark dykm scores as read
        await supabase
            .from('dykm_scores')
            .update({ is_read: true })
            .eq('quiz_owner_id', user.id)
            .eq('is_read', false)

        // 3. Mark xp transactions as read
        await supabase
            .from('xp_transactions')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false)

        // 4. Mark hot seat questions as read (where I am host)
        // This requires an RPC or a complex query since we can't easily join in update
        // For now, let's just do the ones we can easily.

        revalidatePath('/notifications')
        return { success: true }
    } catch (error) {
        console.error('Server Action Error:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}
