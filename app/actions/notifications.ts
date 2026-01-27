'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function hideNotification(id: string, type: 'message' | 'dykm' | 'lobby') {
    const supabase = await createSupabaseServerClient()

    try {
        let table = ''

        switch (type) {
            case 'message':
                table = 'confessions'
                break
            case 'dykm':
                table = 'dykm_scores'
                break
            case 'lobby':
                table = 'tod_messages'
                break
        }

        if (!table) throw new Error('Invalid notification type')

        const { error } = await supabase
            .from(table)
            .update({ is_hidden: true })
            .eq('id', id)

        if (error) throw error

        revalidatePath('/notifications')

        return { success: true }
    } catch (error) {
        console.error('Server Action Error:', error)
        return { success: false, error }
    }
}
