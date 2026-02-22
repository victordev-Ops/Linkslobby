'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendDirectMessage(targetUserId: string, content: string, imageUrl?: string | null) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            console.error('Send DM: Unauthorized', authError)
            throw new Error('Unauthorized')
        }

        console.log(`Send DM: User ${user.id} sending to ${targetUserId}`)

        // Insert Message into Confessions table
        // We use profile_id for recipient and sender_id for the sender
        const { data, error } = await supabase
            .from('confessions')
            .insert({
                profile_id: targetUserId, // Recipient
                sender_id: user.id,       // Sender
                message: content,
                image_url: imageUrl || null,
                message_type: 'direct_message',
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
