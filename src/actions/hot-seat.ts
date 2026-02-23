'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function joinHotSeatSession(sessionId: string) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        // 1. Check if user is banned
        const { data: ban } = await supabase
            .from('hot_seat_bans')
            .select('id')
            .eq('session_id', sessionId)
            .eq('user_id', user.id)
            .single()

        if (ban) {
            return { success: false, error: 'You are banned from this session' }
        }

        // 2. Use upsert to handle re-joining
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

export async function banParticipant(sessionId: string, userId: string) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) return { success: false, error: 'Unauthorized' }

        // 1. Verify host
        const { data: session } = await supabase
            .from('hot_seat_sessions')
            .select('host_id')
            .eq('id', sessionId)
            .single()

        if (!session || session.host_id !== currentUser.id) {
            return { success: false, error: 'Only the host can ban participants' }
        }

        // 2. Add to bans
        const { error: banError } = await supabase
            .from('hot_seat_bans')
            .insert({
                session_id: sessionId,
                user_id: userId
            })

        if (banError) {
            console.error('Error banning participant:', banError)
            return { success: false, error: banError.message }
        }

        // 3. Remove from participants
        await supabase
            .from('hot_seat_participants')
            .delete()
            .eq('session_id', sessionId)
            .eq('user_id', userId)

        revalidatePath(`/hot-seat/[slug]`)
        return { success: true }
    } catch (error) {
        console.error('Ban participant error:', error)
        return { success: false, error: 'Internal server error' }
    }
}
