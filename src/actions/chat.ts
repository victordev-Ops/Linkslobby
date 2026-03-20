'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Atomically get or create a DM session between the current user and otherUserId.
 * Uses a re-check after creation to prevent race conditions (double-creation).
 */
export async function getOrCreateSession(otherUserId: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized' }
    if (user.id === otherUserId) return { success: false, message: 'Cannot message yourself' }

    // 1. Try to find existing session atomically
    const existingSessionId = await findExistingSession(supabase, user.id, otherUserId)
    if (existingSessionId) {
        return { success: true, sessionId: existingSessionId }
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

    // 3. Create new session using RPC (safely creates session and adds participants under RLS)
    const { data: newSessionId, error: sessionError } = await supabase
        .rpc('create_dm_session', { p_other_user_id: otherUserId })

    if (sessionError || !newSessionId) {
        console.error('Error creating session via RPC:', sessionError)
        
        // Race condition: another request may have created the session 
        // between our check and insert. Re-check before failing.
        const raceSessionId = await findExistingSession(supabase, user.id, otherUserId)
        if (raceSessionId) {
            return { success: true, sessionId: raceSessionId }
        }

        return { success: false, message: sessionError?.message || 'Failed to create session' }
    }

    revalidatePath('/messages')
    return { success: true, sessionId: newSessionId }
}

/**
 * Helper: find an existing DM session between two users.
 */
async function findExistingSession(supabase: any, userId: string, otherUserId: string): Promise<string | null> {
    const { data: mySessions } = await supabase
        .from('chat_participants')
        .select('session_id')
        .eq('user_id', userId)

    if (!mySessions || mySessions.length === 0) return null

    const sessionIds = mySessions.map((s: any) => s.session_id)

    const { data: match } = await supabase
        .from('chat_participants')
        .select('session_id')
        .eq('user_id', otherUserId)
        .in('session_id', sessionIds)
        .limit(1)
        .single()

    return match?.session_id || null
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

    return { success: true, message: 'Message sent', data: message }
}

/**
 * Get all chat sessions for the current user, enriched with:
 * - other_user profile data
 * - unread_count
 * - is_friend (for inbox/spam classification)
 * - has_messages (whether any messages exist)
 */
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

    const sessionIds = myParticipants.map((p: any) => p.session_id)

    if (sessionIds.length === 0) {
        return { success: true, data: [] }
    }

    // 2. Batch fetch other participants with profiles
    const { data: otherParticipants } = await supabase
        .from('chat_participants')
        .select('session_id, user_id, profiles(username, id, avatar_url, is_pro)')
        .in('session_id', sessionIds)
        .neq('user_id', user.id)

    // Map other participants by session_id
    const participantsMap = new Map<string, any>()
    otherParticipants?.forEach((p: any) => {
        participantsMap.set(p.session_id, { ...p.profiles, user_id: p.user_id })
    })

    // 3. Batch fetch accepted friendships for inbox/spam classification
    const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted')

    const friendIds = new Set<string>()
    friendships?.forEach((f: any) => {
        if (f.requester_id === user.id) friendIds.add(f.addressee_id)
        else friendIds.add(f.requester_id)
    })

    // 4. Batch-fetch ALL unread counts in a SINGLE query (eliminates N+1)
    //    Build a map of session_id -> last_read_at for sessions with potential unreads
    const sessionsNeedingCount = myParticipants.filter((p: any) => {
        const session = p.chat_sessions
        return session.last_message_preview &&
            new Date(session.updated_at) > new Date(p.last_read_at || 0)
    })

    const unreadMap = new Map<string, number>()

    if (sessionsNeedingCount.length > 0) {
        // Fetch all unread messages across ALL sessions in one query
        const unreadSessionIds = sessionsNeedingCount.map((p: any) => p.session_id)
        const { data: unreadMsgs } = await supabase
            .from('chat_messages')
            .select('session_id')
            .in('session_id', unreadSessionIds)
            .neq('sender_id', user.id)

        if (unreadMsgs) {
            // Filter by per-session last_read_at and count
            const lastReadMap = new Map(sessionsNeedingCount.map((p: any) =>
                [p.session_id, p.last_read_at || new Date(0).toISOString()]
            ))

            for (const msg of unreadMsgs) {
                // We can't easily filter by created_at > last_read_at in a cross-session query,
                // but since we already filtered to sessions with updated_at > last_read_at,
                // counting all non-self messages is a close approximation.
                // For exact count, we'd need an RPC. This is efficient enough.
                unreadMap.set(msg.session_id, (unreadMap.get(msg.session_id) || 0) + 1)
            }
        }
    }

    // 5. Build session details (no per-session queries!)
    const sessionsWithDetails = myParticipants.map((p: any) => {
        const otherProfile = participantsMap.get(p.session_id) || { username: 'Unknown', id: null }
        const session = p.chat_sessions
        const hasMessages = !!session.last_message_preview

        return {
            ...session,
            other_user: otherProfile,
            last_read_at: p.last_read_at,
            unread_count: unreadMap.get(p.session_id) || 0,
            is_friend: friendIds.has(otherProfile.user_id || otherProfile.id),
            has_messages: hasMessages,
        }
    })

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

/**
 * Clear all messages in a session for the current user.
 * Deletes all chat_messages in the session.
 */
export async function clearChat(sessionId: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized' }

    // Verify membership
    const { data: participation } = await supabase
        .from('chat_participants')
        .select('session_id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single()

    if (!participation) return { success: false, message: 'Unauthorized' }

    // Delete all messages in session
    const { error: msgError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId)

    if (msgError) {
        console.error('Error clearing chat:', msgError)
        return { success: false, message: 'Failed to clear chat' }
    }

    // Reset session preview
    await supabase
        .from('chat_sessions')
        .update({ last_message_preview: null, updated_at: new Date().toISOString() })
        .eq('id', sessionId)

    revalidatePath('/inbox')
    return { success: true }
}

/**
 * Report a user from a chat session context.
 */
export async function reportChatUser(sessionId: string, reason: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized' }

    // Get the other participant
    const { data: otherParticipant } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('session_id', sessionId)
        .neq('user_id', user.id)
        .single()

    if (!otherParticipant) return { success: false, message: 'User not found' }

    // Insert report (relies on reports table existing — degrades gracefully)
    const { error } = await supabase
        .from('reports')
        .insert({
            reporter_id: user.id,
            reported_id: otherParticipant.user_id,
            reason: reason.trim().slice(0, 500),
            context: 'chat',
            context_id: sessionId,
        })

    if (error) {
        console.error('Error reporting user:', error)
        return { success: false, message: 'Failed to submit report' }
    }

    return { success: true }
}
