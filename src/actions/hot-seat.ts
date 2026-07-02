'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type ActionResult = { success: boolean; error?: string }

// ─── Join a Hot Seat session ───
export async function joinHotSeatSession(sessionId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: session } = await supabase
        .from('hot_seat_sessions')
        .select('id, host_id, is_closed')
        .eq('id', sessionId)
        .single()

    if (!session) return { success: false, error: 'Session not found' }

    // Host is always allowed in — they're auto-joined on creation
    if (session.host_id === user.id) return { success: true }

    // Banned users can never rejoin unless the host unbans them
    const { data: ban } = await supabase
        .from('hot_seat_bans')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (ban) return { success: false, error: 'You have been banned from this session' }

    // Already a participant — nothing to do
    const { data: existing } = await supabase
        .from('hot_seat_participants')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (existing) return { success: true }

    // Closed sessions only block *new* joins, not existing participants
    if (session.is_closed) {
        return { success: false, error: 'This session is closed to new participants' }
    }

    const { error } = await supabase.from('hot_seat_participants').insert({
        session_id: sessionId,
        user_id: user.id,
        status: 'joined'
    })

    if (error) {
        console.error('Join session error:', error)
        return { success: false, error: 'Failed to join session' }
    }

    return { success: true }
}

// ─── Ban a participant (host only) ───
export async function banParticipant(sessionId: string, userId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: session } = await supabase
        .from('hot_seat_sessions')
        .select('host_id')
        .eq('id', sessionId)
        .single()

    if (!session || session.host_id !== user.id) {
        return { success: false, error: 'Only the host can ban participants' }
    }
    if (userId === session.host_id) {
        return { success: false, error: 'The host cannot be banned' }
    }

    const { error: banError } = await supabase.from('hot_seat_bans').insert({
        session_id: sessionId,
        user_id: userId,
        banned_by: user.id
    })

    if (banError) {
        console.error('Ban participant error:', banError)
        return { success: false, error: 'Failed to ban participant' }
    }

    const { error: removeError } = await supabase
        .from('hot_seat_participants')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId)

    if (removeError) console.error('Failed to remove banned participant:', removeError)

    return { success: true }
}

// ─── Unban a participant (host only) ───
export async function unbanParticipant(sessionId: string, userId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: session } = await supabase
        .from('hot_seat_sessions')
        .select('host_id')
        .eq('id', sessionId)
        .single()

    if (!session || session.host_id !== user.id) {
        return { success: false, error: 'Only the host can unban participants' }
    }

    const { error } = await supabase
        .from('hot_seat_bans')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId)

    if (error) {
        console.error('Unban participant error:', error)
        return { success: false, error: 'Failed to unban participant' }
    }

    return { success: true }
}

// ─── Get banned users for a session (host only) ───
export type BannedUser = {
    id: string
    username: string
    slug: string
    avatar_url: string | null
    banned_at: string
}

export async function getBannedParticipants(sessionId: string): Promise<BannedUser[]> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: session } = await supabase
        .from('hot_seat_sessions')
        .select('host_id')
        .eq('id', sessionId)
        .single()

    if (!session || session.host_id !== user.id) return []

    const { data: bans } = await supabase
        .from('hot_seat_bans')
        .select('user_id, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

    if (!bans || bans.length === 0) return []

    const userIds = bans.map(b => b.user_id)
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, slug, avatar_url')
        .in('id', userIds)

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    return bans.map(b => {
        const p = profileMap.get(b.user_id)
        return {
            id: b.user_id,
            username: p?.username || 'Unknown',
            slug: p?.slug || '',
            avatar_url: p?.avatar_url || null,
            banned_at: b.created_at
        }
    })
}

// ─── Close a session — blocks new participants from joining ───
export async function closeHotSeatSession(sessionId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: session } = await supabase
        .from('hot_seat_sessions')
        .select('host_id')
        .eq('id', sessionId)
        .single()

    if (!session || session.host_id !== user.id) {
        return { success: false, error: 'Only the host can close this session' }
    }

    const { error } = await supabase
        .from('hot_seat_sessions')
        .update({ is_closed: true })
        .eq('id', sessionId)

    if (error) {
        console.error('Close session error:', error)
        return { success: false, error: 'Failed to close session' }
    }

    return { success: true }
}

// ─── Reopen a session for new participants ───
export async function reopenHotSeatSession(sessionId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: session } = await supabase
        .from('hot_seat_sessions')
        .select('host_id')
        .eq('id', sessionId)
        .single()

    if (!session || session.host_id !== user.id) {
        return { success: false, error: 'Only the host can reopen this session' }
    }

    const { error } = await supabase
        .from('hot_seat_sessions')
        .update({ is_closed: false })
        .eq('id', sessionId)

    if (error) {
        console.error('Reopen session error:', error)
        return { success: false, error: 'Failed to reopen session' }
    }

    return { success: true }
}

// ─── Permanently delete a session (host only) ───
export async function deleteHotSeatSession(sessionId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: session } = await supabase
        .from('hot_seat_sessions')
        .select('host_id')
        .eq('id', sessionId)
        .single()

    if (!session || session.host_id !== user.id) {
        return { success: false, error: 'Only the host can delete this session' }
    }

    // Clean up dependent rows defensively in case FKs aren't set to cascade
    await supabase.from('hot_seat_questions').delete().eq('session_id', sessionId)
    await supabase.from('hot_seat_participants').delete().eq('session_id', sessionId)
    await supabase.from('hot_seat_bans').delete().eq('session_id', sessionId)

    const { error } = await supabase
        .from('hot_seat_sessions')
        .delete()
        .eq('id', sessionId)

    if (error) {
        console.error('Delete session error:', error)
        return { success: false, error: 'Failed to delete session' }
    }

    return { success: true }
}
