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
        return { success: false, error }
    }
}
