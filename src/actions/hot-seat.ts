'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function joinHotSeatSession(sessionId: string) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        // Use upsert to handle re-joining
        const { error } = await supabase
            .from('hot_seat_participants')
            .upsert({
                session_id: sessionId,
                user_id: user.id,
                status: 'joined'
            }, {
                onConflict: 'session_id,user_id'
            })

        if (error) {
            console.error('Error joining hot seat:', error)
            return { success: false, error: error.message }
        }

        revalidatePath(`/hot-seat/[slug]`)
        return { success: true }
    } catch (error) {
        console.error('Server action error:', error)
        return { success: false, error: 'Internal server error' }
    }
}
