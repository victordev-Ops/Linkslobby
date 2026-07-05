import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DirectMessageClient from '@/components/tod/DirectMessageClient'
import { findExistingSession, getSessionMessages } from '@/actions/chat'

const INITIAL_MESSAGE_PAGE_SIZE = 20

export const dynamic = 'force-dynamic'

// Helper to check UUID format
const isUUID = (str: string) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return regex.test(str)
}

/**
 * IMPORTANT: this page NEVER creates a chat_sessions/chat_participants row.
 * It only reads. If no session exists yet between the current user and the
 * target, it renders <DirectMessageClient> in "draft" mode (sessionId=null).
 * The very first message the user sends is what atomically creates the
 * session, via sendMessageToUser() -> the send_dm_message RPC. If the user
 * navigates away without sending anything, nothing was ever persisted.
 */
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // ── Case 1: id is a username (profile slug), not a UUID at all ──
    if (!isUUID(id)) {
        const { data: targetProfile } = await supabase
            .from('profiles')
            .select('id, username, slug, avatar_url, is_pro, deactivated_at, dms_disabled')
            .eq('username', id)
            .maybeSingle()

        if (!targetProfile) notFound()
        if (targetProfile.deactivated_at) {
            // Account no longer active — nothing to draft a conversation with.
            redirect('/inbox')
        }

        return renderForTarget(supabase, user.id, targetProfile)
    }

    // ── Case 2: id is a UUID — could be an existing session id OR a user id ──

    // Try it as a session id first, and confirm the current user is actually
    // a participant (read-only, RLS-safe).
    //
    // The message fetch is kicked off in parallel with the session/participant
    // query instead of after it. If it turns out the user isn't a participant
    // we discard the result below — that wasted query is far cheaper than the
    // serial round trip it replaces, and RLS on chat_messages already scopes
    // rows to actual participants via is_chat_participant(), so nothing more
    // sensitive leaks by firing it speculatively.
    const [{ data: fullSessionData }, messagesResult] = await Promise.all([
        supabase
            .from('chat_sessions')
            .select(`
                id,
                chat_participants (
                    user_id,
                    profiles ( id, username, slug, xp_balance, avatar_url, is_pro, deactivated_at )
                )
            `)
            .eq('id', id)
            .maybeSingle(),
        getSessionMessages(id, undefined, INITIAL_MESSAGE_PAGE_SIZE),
    ])

    if (fullSessionData) {
        const isParticipant = fullSessionData.chat_participants.some((p: any) => p.user_id === user.id)
        if (isParticipant) {
            const otherParticipant = fullSessionData.chat_participants.find((p: any) => p.user_id !== user.id)
            const rawProfile = otherParticipant?.profiles
            const profileData = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile

            const targetProfile = {
                id: profileData?.id || null,
                username: profileData?.username || 'Unknown User',
                avatar_url: profileData?.avatar_url || null,
                is_pro: profileData?.is_pro || false,
                slug: profileData?.slug || null,
                is_deactivated: !profileData || !!profileData?.deactivated_at,
            }

            return (
                <DirectMessageClient
                    sessionId={fullSessionData.id}
                    isDraft={false}
                    currentUser={user}
                    targetProfile={targetProfile}
                    initialMessages={messagesResult.success ? messagesResult.data : []}
                    initialHasMore={messagesResult.success ? (messagesResult.data?.length ?? 0) >= INITIAL_MESSAGE_PAGE_SIZE : false}
                />
            )
        }
        // A session exists with this id but the user isn't in it — treat as not found,
        // don't fall through to "treat id as a user id" (that would be a confused state).
        notFound()
    }

    // Not a session id. Try it as a user id instead — this is the "new DM" entry point.
    const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id, username, slug, avatar_url, is_pro, deactivated_at, dms_disabled')
        .eq('id', id)
        .maybeSingle()

    if (!targetProfile) notFound()
    if (targetProfile.id === user.id) redirect('/inbox') // can't message yourself
    if (targetProfile.deactivated_at) redirect('/inbox')

    return renderForTarget(supabase, user.id, targetProfile)
}

/**
 * Shared logic once we've resolved a valid target profile (by username or by id):
 * check read-only whether a session already exists; if so redirect into it
 * (canonical /messages/<sessionId> URL), otherwise render draft mode.
 */
async function renderForTarget(supabase: any, myId: string, targetProfile: any) {
    const existing = await findExistingSession(targetProfile.id)

    if (existing.success && existing.sessionId) {
        redirect(`/messages/${existing.sessionId}`)
    }

    // No session yet — draft mode. Nothing has been written to the DB.
    return (
        <DirectMessageClient
            sessionId={null}
            isDraft={true}
            currentUser={{ id: myId }}
            targetProfile={{
                id: targetProfile.id,
                username: targetProfile.username || null,
                avatar_url: targetProfile.avatar_url || null,
                is_pro: targetProfile.is_pro || false,
                slug: targetProfile.slug || null,
                dms_disabled: targetProfile.dms_disabled || false,
            }}
        />
    )
    }
