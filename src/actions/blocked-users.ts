'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface BlockedUser {
    id: string
    blocked_id: string
    username: string
    created_at: string
}

export interface BlockedAnonymous {
    id: string
    ip_address: string
    user_agent: string | null
    label: string
    created_at: string
}

// ─── Authenticated User Blocking ───

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

/** Check if senderId is blocked by recipientId - Uses admin client to bypass RLS */
export async function isUserBlocked(recipientId: string, senderId: string): Promise<boolean> {
    try {
        const adminSupabase = createSupabaseAdminClient()
        const { data } = await adminSupabase
            .from('blocked_users')
            .select('id')
            .eq('blocker_id', recipientId)
            .eq('blocked_id', senderId)
            .maybeSingle()

        return !!data
    } catch (error) {
        console.error('[BlockedUsers] SECURITY: admin check failed, denying send by default. Check SUPABASE_SERVICE_ROLE_KEY.', error)
        return true // Fail CLOSED: a broken block-check must never silently let a blocked message through.
    }
}

/**
 * Batched version of isUserBlocked — checks whether ANY of the given
 * otherUserIds has a block relationship (in either direction) with senderId,
 * in a single query instead of one round trip per participant. Fails CLOSED.
 */
export async function isAnyBlocked(otherUserIds: string[], senderId: string): Promise<boolean> {
    const ids = otherUserIds.filter(Boolean)
    if (ids.length === 0) return false

    try {
        const adminSupabase = createSupabaseAdminClient()
        const { data, error } = await adminSupabase
            .from('blocked_users')
            .select('id')
            .or(
                ids.map(id => `and(blocker_id.eq.${id},blocked_id.eq.${senderId})`).join(',') +
                ',' +
                ids.map(id => `and(blocker_id.eq.${senderId},blocked_id.eq.${id})`).join(',')
            )
            .limit(1)

        if (error) throw error
        return (data?.length || 0) > 0
    } catch (error) {
        console.error('[BlockedUsers] SECURITY: batched admin check failed, denying send by default. Check SUPABASE_SERVICE_ROLE_KEY.', error)
        return true // Fail CLOSED
    }
}

// ─── Anonymous Sender Blocking (IP + UA) ───

export async function getBlockedAnonymous(): Promise<BlockedAnonymous[]> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('blocked_anonymous')
        .select('id, ip_address, user_agent, label, created_at')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('getBlockedAnonymous error:', error)
        return []
    }

    return data || []
}

/**
 * Block an anonymous sender by extracting their IP + UA from a confession's metadata.
 * Called from the MessageViewClient report modal.
 */
export async function blockAnonymousSender(confessionId: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Fetch the confession and extract metadata
    const { data: confession } = await supabase
        .from('confessions')
        .select('message, profile_id, sender_id')
        .eq('id', confessionId)
        .single()

    if (!confession) return { success: false, error: 'Message not found' }
    if (confession.profile_id !== user.id) return { success: false, error: 'Not your message' }

    // Parse [META:...] from message
    const metaMatch = confession.message.match(/\[META:(.*)\]$/s)
    if (!metaMatch?.[1]) return { success: false, error: 'No sender data available' }

    let meta: { ip?: string; ua?: string }
    try {
        meta = JSON.parse(metaMatch[1])
    } catch {
        return { success: false, error: 'Could not parse sender data' }
    }

    if (!meta.ip || meta.ip === 'unknown') return { success: false, error: 'No IP data for this sender' }

    const { error } = await supabase
        .from('blocked_anonymous')
        .upsert({
            blocker_id: user.id,
            ip_address: meta.ip,
            user_agent: meta.ua || null,
            label: `Anonymous (${meta.ip.slice(-4)})`,
        }, { onConflict: 'blocker_id,ip_address', ignoreDuplicates: true })

    if (error) {
        console.error('blockAnonymousSender error:', error)
        return { success: false, error: error.message }
    }

    // NEW: If this message was sent by an authenticated user, block their account ID too
    if (confession.sender_id) {
        await blockUser(confession.sender_id)
    }

    revalidatePath('/settings')
    return { success: true }
}

export async function unblockAnonymous(id: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { error } = await supabase
        .from('blocked_anonymous')
        .delete()
        .eq('id', id)
        .eq('blocker_id', user.id)

    if (error) {
        console.error('unblockAnonymous error:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
}

/** Check if an anonymous sender (by IP) is blocked by a specific user - Uses admin client to bypass RLS */
export async function isAnonymousBlocked(blockerId: string, ip: string): Promise<boolean> {
    if (!ip || ip === 'unknown') return false

    try {
        const adminSupabase = createSupabaseAdminClient()
        const { data } = await adminSupabase
            .from('blocked_anonymous')
            .select('id')
            .eq('blocker_id', blockerId)
            .eq('ip_address', ip)
            .maybeSingle()

        return !!data
    } catch (error) {
        console.warn('[BlockedUsers] Anonymous block check failed. Missing SUPABASE_SERVICE_ROLE_KEY?', error)
        return false // Fallback: allow if we can't check
    }
}
