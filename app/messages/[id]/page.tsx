import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { DirectMessageClient } from '@/components/tod/DirectMessageClient'
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

    // A. If ID is NOT a UUID, treat as username and redirect
    if (!isUUID(id)) {
        // 1. Find profile by username
        const { data: targetProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', id)
            .single()

        if (!targetProfile) {
            notFound()
        }

        // 2. Get or create session
        const result = await getOrCreateSession(targetProfile.id)

        if (result.success && result.sessionId) {
            redirect(`/messages/${result.sessionId}`)
        } else {
            // Handle error (e.g., self-message attempt or DB error)
            redirect('/messages')
        }
    }

    // B. If ID IS a UUID, treat as Session ID (Original Logic)
    const sessionId = id

    // Fetch Session & Verify Participation
    const { data: sessionData, error } = await supabase
        .from('chat_sessions')
        .select(`
            id,
            chat_participants (
                user_id,
                profiles (
                   id,
                   username,
                   slug,
                   xp_balance
                )
            )
        `)
        .eq('id', sessionId)
        .single()

    if (error || !sessionData) {
        notFound()
    }

    // Ensure current user is a participant
    const isParticipant = sessionData.chat_participants.some((p: any) => p.user_id === user.id)
    if (!isParticipant) {
        notFound() // Or redirect to inbox
    }

    // Get the other participant's profile
    // If only one participant (self-chat loop?), handle accordingly
    const otherParticipant = sessionData.chat_participants.find((p: any) => p.user_id !== user.id)

    // Fallback if chatting with self or data issue
    const fallback = { id: 'unknown', username: 'Unknown User' }

    // Handle array case for profiles (though it should be single obj due to FK)
    const rawProfile = otherParticipant?.profiles
    const profileData = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile

    const targetProfile = {
        id: profileData?.id || fallback.id,
        username: profileData?.username || fallback.username
    }

    return <DirectMessageClient sessionId={sessionId} currentUser={user} targetProfile={targetProfile} />
}
