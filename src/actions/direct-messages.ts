'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendDirectMessage(targetUserId: string, content: string) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            console.error('Send DM: Unauthorized', authError)
            throw new Error('Unauthorized')
        }

        console.log(`Send DM: User ${user.id} sending to ${targetUserId}`)

        // 1. Get Sender Profile (for caching/display purposes if needed)
        const { data: senderProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single()

        const senderUsername = senderProfile?.username || 'Someone'

        // 2. Insert Message into Confessions table
        // structured as a direct_message
        const { data, error } = await supabase
            .from('confessions')
            .insert({
                profile_id: targetUserId, // Recipient
                message: `[DM:${user.id}:${senderUsername}] ${content}`,
                message_type: 'confession', // Fallback to allowed type
            })
            .select('id')
            .single()

        if (error) {
            console.error('Send DM: Insert Error', error)
            throw error
        }

        console.log('Send DM: Success', data.id)

        return { success: true, id: data.id }
    } catch (error) {
        console.error('Send DM Error:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}
