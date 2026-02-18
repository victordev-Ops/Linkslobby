'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BlockedUser {
    id: string
    blocked_id: string
    username: string
    created_at: string
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('blocked_users')
        .select('id, blocked_id, created_at, profiles:blocked_id(username)')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('getBlockedUsers error:', error)
        return []
    }

    return (data || []).map((row: any) => ({
        id: row.id,
        blocked_id: row.blocked_id,
        username: row.profiles?.username || 'Unknown',
        created_at: row.created_at,
    }))
}

export async function blockUser(targetId: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }
    if (targetId === user.id) return { success: false, error: 'Cannot block yourself' }

    const { error } = await supabase
        .from('blocked_users')
        .upsert({ blocker_id: user.id, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true })

    if (error) {
        console.error('blockUser error:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
}

export async function unblockUser(targetId: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetId)

    if (error) {
        console.error('unblockUser error:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
}
