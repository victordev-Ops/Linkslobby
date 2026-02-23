'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getOrCreateSession(otherUserId: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized' }

    // 1. Check if session exists
    // We need to find a session where both users are participants
    // This is a bit tricky in Supabase/Postgres without a specific query or view
    // Strategy: Find all sessions I am in, then check if otherUserId is also in them.
    // Optimization: filtering by participant count = 2 for DMs

    // RPC or detailed query is best here. For now, let's do a client-side filter approach or raw query if possible.
    // Supabase JS doesn't support complex joins easily for this "intersection" query without RPC.
    // Let's try to fetch my sessions and their participants.

    // Actually, let's use a stored procedure if performance matters, but for now:
    const { data: mySessions } = await supabase
        .from('chat_participants')
        .select('session_id')
        .eq('user_id', user.id)

    if (mySessions && mySessions.length > 0) {
        const sessionIds = mySessions.map(s => s.session_id)

        const { data: existingSession } = await supabase
            .from('chat_participants')
            .select('session_id')
            .eq('user_id', otherUserId)
            .in('session_id', sessionIds)
            .single()

        if (existingSession) {
            return { success: true, sessionId: existingSession.session_id }
        }
    }

    // 2. Check if other user has DMs disabled
    const { data: targetProfile, error: profileError } = await supabase
        .from('profiles')
        .select('dms_disabled, username')
        .eq('id', otherUserId)
        .single()

    if (profileError || !targetProfile) {
        return { success: false, message: 'User not found' }
    }

    if (targetProfile.dms_disabled) {
        return { success: false, message: `@${targetProfile.username} has disabled direct messages.` }
    }

    // 3. Create new session
    const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({})
        .select()
        .single()

    if (sessionError || !newSession) {
        console.error('Error creating session:', sessionError)
        return { success: false, message: 'Failed to create session' }
    }

    // 3. Add participants
    const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert([
            { session_id: newSession.id, user_id: user.id },
            { session_id: newSession.id, user_id: otherUserId }
        ])

    if (participantsError) {
        console.error('Error adding participants:', participantsError)
        return { success: false, message: 'Failed to add participants' }
    }

    revalidatePath('/messages')
    return { success: true, sessionId: newSession.id }
}

export async function sendMessage(sessionId: string, content: string, replyToId?: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized' }

    // Check if sender is blocked by any other participant in this session
    const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('session_id', sessionId)
        .neq('user_id', user.id)

    if (participants && participants.length > 0) {
        const { isUserBlocked } = await import('@/actions/blocked-users')
        for (const p of participants) {
            const blocked = await isUserBlocked(p.user_id, user.id)
            if (blocked) {
                return { success: false, message: 'Unable to send message.' }
            }
        }
    }

    // 1. Insert Message
    const { data: message, error: msgError } = await supabase
        .from('chat_messages')
        .insert({
            session_id: sessionId,
            sender_id: user.id,
            content: content,
            reply_to_id: replyToId
        })
        .select(`
            *,
            reply:chat_messages!reply_to_id(
                id,
                content,
                sender_id,
                profiles(username)
            )
        `)
        .single()

    if (msgError) {
        console.error('Error sending message:', msgError)
        return { success: false, message: 'Failed to send message' }
    }

    // 2. Update Session (for inbox sorting/preview)
    await supabase
        .from('chat_sessions')
        .update({
            updated_at: new Date().toISOString(),
            last_message_preview: content.substring(0, 50)
        })
        .eq('id', sessionId)

    // 3. Trigger Revalidation / Notification logic (if needed beyond realtime)
    // Realtime subscription in client will handle the UI update.

    return { success: true, message: 'Message sent', data: message }
}

export async function getSessions() {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized', data: [] }

    // 1. Fetch user's sessions
    const { data: myParticipants, error } = await supabase
        .from('chat_participants')
        .select(`
            session_id,
            last_read_at,
            chat_sessions (
                id,
                updated_at,
                last_message_preview
            )
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })

    if (error || !myParticipants) {
        console.error('Error fetching sessions:', error)
        return { success: false, message: 'Failed to fetch sessions', data: [] }
    }

    const sessionIds = myParticipants.map(p => p.session_id)

    if (sessionIds.length === 0) {
        return { success: true, data: [] }
    }

    // 2. Batch fetch other participants
    const { data: otherParticipants } = await supabase
        .from('chat_participants')
        .select('session_id, profiles(username, id)')
        .in('session_id', sessionIds)
        .neq('user_id', user.id)

    // Map other participants by session_id
    const participantsMap = new Map()
    otherParticipants?.forEach((p: any) => {
        participantsMap.set(p.session_id, p.profiles)
    })

    // 3. Batch fetch unread counts? 
    // Optimization: Only fetch count if updated_at > last_read_at
    // But we can't easily batch count with condition per row.
    // We'll proceed with Promise.all for now but it's only for "Unread" ones, and simpler.
    // Actually, let's just stick to the current unread logic for now but at least we saved N queries for profiles.
    // That's 50% reduction.

    const sessionsWithDetails = await Promise.all(myParticipants.map(async (p: any) => {
        const otherProfile = participantsMap.get(p.session_id) || { username: 'Unknown' }
        const session = p.chat_sessions

        let unreadCount = 0

        // Only query count if potentially unread
        if (new Date(session.updated_at) > new Date(p.last_read_at || 0)) {
            const { count } = await supabase
                .from('chat_messages')
                .select('*', { count: 'exact', head: true })
                .eq('session_id', p.session_id)
                .neq('sender_id', user.id)
                .gt('created_at', p.last_read_at || new Date(0).toISOString())

            unreadCount = count || 0
        }

        return {
            ...session,
            other_user: otherProfile,
            last_read_at: p.last_read_at,
            unread_count: unreadCount
        }
    }))

    // Sort by updated_at desc
    sessionsWithDetails.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

    return { success: true, data: sessionsWithDetails }
}

export async function getSessionMessages(sessionId: string, before?: string, limit = 50) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized', data: [] }

    // Verify membership
    const { data: participation } = await supabase
        .from('chat_participants')
        .select('session_id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single()

    if (!participation) return { success: false, message: 'Unauthorized', data: [] }

    let query = supabase
        .from('chat_messages')
        .select(`
            *,
            reply:chat_messages!reply_to_id(
                id,
                content,
                sender_id,
                profiles(username)
            )
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false }) // Newest first for pagination logic
        .limit(limit)

    if (before) {
        query = query.lt('created_at', before)
    }

    const { data: messages, error } = await query

    if (error) {
        console.error('Error fetching messages:', error)
        return { success: false, message: 'Failed to fetch messages', data: [] }
    }

    // Return reversed so client gets oldest -> newest
    return { success: true, data: messages ? messages.reverse() : [] }
}

export async function markSessionRead(sessionId: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false }

    const { error } = await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)

    if (error) console.error('Error marking read:', error)

    return { success: !error }
}
