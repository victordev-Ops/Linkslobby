'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * READ-ONLY. Checks whether a DM session already exists between the current
 * user and otherUserId. Does NOT create anything — safe to call from a page
 * render. Used to redirect straight into an existing thread; if nothing comes
 * back, the caller should render a client-side "draft" conversation instead
 * of persisting a session.
 */
export async function findExistingSession(otherUserId: string): Promise<{ success: boolean; sessionId: string | null; message?: string }> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, sessionId: null, message: 'Unauthorized' }
    if (user.id === otherUserId) return { success: false, sessionId: null, message: 'Cannot message yourself' }

    const { data, error } = await supabase.rpc('find_dm_session', { p_other_user_id: otherUserId })

    if (error) {
        console.error('findExistingSession error:', error)
        return { success: false, sessionId: null, message: 'Failed to look up conversation' }
    }

    return { success: true, sessionId: data || null }
}

/**
 * Sends a message to a user by their id, atomically creating the session
 * (and only the session — no empty rows ever persist for a conversation that
 * never gets a first message) if one doesn't exist yet. This is what the
 * client should call on "first send" from a draft conversation, and it's also
 * safe to call for an already-existing thread (it'll just reuse it).
 *
 * All of the block-check / dms_disabled-check / get-or-create / insert logic
 * lives in a single DB transaction (see send_dm_message RPC) so there's no
 * TOCTOU race and no partial state if something fails midway.
 */
export async function sendMessageToUser(otherUserId: string, content: string, replyToId?: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized' }

    const trimmed = content.trim()
    if (!trimmed) return { success: false, message: 'Message cannot be empty' }

    const { data, error } = await supabase.rpc('send_dm_message', {
        p_other_user_id: otherUserId,
        p_content: trimmed,
        p_reply_to_id: replyToId || null,
    })

    if (error || !data?.success) {
        console.error('sendMessageToUser error:', error || data?.error)
        return { success: false, message: data?.error || error?.message || 'Failed to send message' }
    }

    revalidatePath('/inbox')
    return { success: true, sessionId: data.session_id, data: data.message }
}

export async function sendMessage(sessionId: string, content: string, replyToId?: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized' }

    const trimmed = content.trim()
    if (!trimmed) return { success: false, message: 'Message cannot be empty' }

    // Check if sender is blocked by (or has blocked) any other participant in
    // this session. Batched into a single query instead of one round trip per
    // participant, and fails CLOSED (denies the send) if the check itself
    // errors — a broken block-check should never silently let messages through.
    const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('session_id', sessionId)
        .neq('user_id', user.id)

    if (participants && participants.length > 0) {
        const { isAnyBlocked } = await import('@/actions/blocked-users')
        const otherIds = participants.map((p: any) => p.user_id).filter(Boolean)
        const blocked = await isAnyBlocked(otherIds, user.id)
        if (blocked) {
            return { success: false, message: 'Unable to send message.' }
        }
    }

    // 1. Insert Message
    // Never trust reply_to_id blindly — a stale/bogus value (e.g. an old
    // client referencing a temp-* optimistic id, or any other mismatch)
    // should degrade to "send the message without a reply link" rather than
    // either failing the whole send or persisting a reply_to_id that points
    // nowhere. The latter is what let broken reply links slip into the DB
    // silently: they'd render fine from local state in the sender's own
    // session, then lose their reply context for good the next time
    // anyone (this session included, after a refresh) re-fetched messages
    // and the join found no matching row.
    let validReplyToId: string | undefined = undefined
    if (replyToId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(replyToId)
        if (isUuid) {
            const { data: parentMsg } = await supabase
                .from('chat_messages')
                .select('id')
                .eq('id', replyToId)
                .eq('session_id', sessionId)
                .maybeSingle()
            if (parentMsg) validReplyToId = replyToId
        }
    }

    const { data: message, error: msgError } = await supabase
        .from('chat_messages')
        .insert({
            session_id: sessionId,
            sender_id: user.id,
            content: trimmed,
            reply_to_id: validReplyToId
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
            last_message_preview: trimmed.substring(0, 50)
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
        // Fetch all unread-candidate messages across ALL sessions in one query.
        // We now also select created_at so we can filter precisely per-session
        // against that session's own last_read_at below — previously this counted
        // EVERY non-self message in a flagged session (an "approximation" per the
        // old comment here), which meant sending a new message to a session you'd
        // already fully read would resurrect all of the other person's old,
        // already-read messages as "unread" again. That approximation is gone.
        const unreadSessionIds = sessionsNeedingCount.map((p: any) => p.session_id)
        const { data: unreadMsgs } = await supabase
            .from('chat_messages')
            .select('session_id, created_at')
            .in('session_id', unreadSessionIds)
            .neq('sender_id', user.id)

        if (unreadMsgs) {
            const lastReadMap = new Map(sessionsNeedingCount.map((p: any) =>
                [p.session_id, p.last_read_at || new Date(0).toISOString()]
            ))

            for (const msg of unreadMsgs) {
                const lastRead = lastReadMap.get(msg.session_id)
                if (lastRead && new Date(msg.created_at) > new Date(lastRead)) {
                    unreadMap.set(msg.session_id, (unreadMap.get(msg.session_id) || 0) + 1)
                }
            }
        }
    }

    // 5. Build session details (no per-session queries!)
    const sessionsWithDetails = myParticipants.map((p: any) => {
        const otherProfile = participantsMap.get(p.session_id) || { username: 'Unknown', id: null }
        const session = p.chat_sessions
        const hasMessages = !!session?.last_message_preview

        return {
            ...session,
            other_user: {
                ...otherProfile,
                is_deactivated: otherProfile.id == null,
            },
            last_read_at: p.last_read_at,
            unread_count: unreadMap.get(p.session_id) || 0,
            is_friend: friendIds.has(otherProfile.user_id || otherProfile.id),
            has_messages: hasMessages,
        }
    })
        // Safety net: with the atomic send_dm_message RPC, a session should never
        // exist without a message. Filter defensively anyway in case of legacy
        // rows or partial failures, so nothing empty ever reaches the inbox UI.
        .filter((s: any) => s.has_messages)

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
        .select('session_id, cleared_before')
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

    // Respect this user's own "clear chat" — hides messages before the clear
    // point for them only, without touching the other participant's history.
    if (participation.cleared_before) {
        query = query.gt('created_at', participation.cleared_before)
    }

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
 * Clear chat HISTORY FOR ME ONLY. Sets a per-participant "cleared_before"
 * marker instead of deleting rows — the other participant's copy of the
 * conversation is untouched.
 */
export async function clearChat(sessionId: string) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized' }

    const { data, error } = await supabase.rpc('clear_my_chat', { p_session_id: sessionId })

    if (error || !data?.success) {
        console.error('Error clearing chat:', error || data?.error)
        return { success: false, message: data?.error || 'Failed to clear chat' }
    }

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
            reported_user_id: otherParticipant.user_id, // was `reported_id` — wrong column, insert was silently failing
            reason: reason.trim().slice(0, 500),
            report_type: 'chat',
            context: 'chat',
            context_id: sessionId,
        })

    if (error) {
        console.error('Error reporting user:', error)
        return { success: false, message: 'Failed to submit report' }
    }

    return { success: true }
}
