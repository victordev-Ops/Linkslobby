import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DirectMessageClient from '@/components/tod/DirectMessageClient'
import { getOrCreateSession } from '@/actions/chat'

// Helper to check UUID format
const isUUID = (str: string) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return regex.test(str)
}

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    if (!isUUID(id)) {
        // Find profile by username
        const { data: targetProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', id)
            .single()

        if (!targetProfile) {
            notFound()
        }

        // Get or create session
        const result = await getOrCreateSession(targetProfile.id)

        if (result.success && result.sessionId) {
            redirect(`/messages/${result.sessionId}`)
        } else {
            // Handle error (e.g., self-message attempt or DB error)
            redirect('/inbox')
        }
    }

    const sessionIdOrUserId = id

    // Try treating ID as a Session ID first
    const { data: sessionData, error: sessionFetchError } = await supabase
        .from('chat_sessions')
        .select(`
            id,
            chat_participants!inner (
                user_id,
                profiles (
                   id,
                   username,
                   slug,
                   xp_balance,
                   avatar_url,
                   is_pro
                )
            )
        `)
        .eq('id', sessionIdOrUserId)
        .maybeSingle()
        
    // Also ensuring user is a participant using `!inner` doesn't return full participant list
    // so we re-fetch all participants for that session if it exists to get the other profile
    let isSessionValidAndJoined = false
    let finalSessionDataForRender: any = null

    if (sessionData) {
        // Re-query to get all participants for this session
         const { data: fullSessionData } = await supabase
            .from('chat_sessions')
            .select(`
                id,
                chat_participants (
                    user_id,
                    profiles (
                       id,
                       username,
                       slug,
                       xp_balance,
                       avatar_url,
                       is_pro
                    )
                )
            `)
            .eq('id', sessionData.id)
            .single()
            
        if (fullSessionData) {
            const isParticipant = fullSessionData.chat_participants.some((p: any) => p.user_id === user.id)
            if (isParticipant) {
                isSessionValidAndJoined = true
                finalSessionDataForRender = fullSessionData
            }
        }
    }

    if (!isSessionValidAndJoined) {
        // Not a valid session or user not in it. Treat ID as user_id.
        const { data: targetProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', sessionIdOrUserId)
            .maybeSingle()

        if (!targetProfile) {
            notFound() // Neither a valid session nor a valid user
        }

        // Get or create session using the user_id
        const result = await getOrCreateSession(targetProfile.id)

        if (result.success && result.sessionId) {
             // Avoid infinite loop if somehow result.sessionId is exactly the SAME as url id
             if (result.sessionId !== sessionIdOrUserId) {
                redirect(`/messages/${result.sessionId}`)
             }
             // It created a session that somehow shares UUID with user? Exceptionally rare.
        } else {
            // Fail safely to inbox
            redirect('/inbox')
        }
    }

    if (!finalSessionDataForRender) {
         notFound()
    }

    // Current session is valid and user is participant. Render Client.
    const otherParticipant = finalSessionDataForRender.chat_participants.find((p: any) => p.user_id !== user.id)

    const fallback = { id: 'unknown', username: 'Unknown User' }
    const rawProfile = otherParticipant?.profiles
    const profileData = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile

    const targetProfile = {
        id: profileData?.id || fallback.id,
        username: profileData?.username || fallback.username,
        avatar_url: profileData?.avatar_url || null,
        is_pro: profileData?.is_pro || false,
        slug: profileData?.slug || null
    }

    return <DirectMessageClient sessionId={finalSessionDataForRender.id} currentUser={user} targetProfile={targetProfile} />
}
