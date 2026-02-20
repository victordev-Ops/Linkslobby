import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DirectMessageClient from '@/components/tod/DirectMessageClient'

interface PageProps {
    params: Promise<{
        sessionId: string
    }>
}

export default async function MessageSessionPage({ params }: PageProps) {
    const { sessionId } = await params
    const supabase = await createSupabaseServerClient()

    // 1. Check Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // 2. Validate Session & Membership
    // We check if the session exists and if the user is a participant
    const { data: participation, error } = await supabase
        .from('chat_participants')
        .select(`
            session_id,
            chat_sessions (
                id,
                created_at
            )
        `)
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single()

    if (error || !participation) {
        return notFound()
    }

    // 3. Get Other Participant Info (for header)
    const { data: otherParticipant } = await supabase
        .from('chat_participants')
        .select(`
            user_id,
            profiles (
                id,
                username,
                slug,
                is_pro
            )
        `)
        .eq('session_id', sessionId)
        .neq('user_id', user.id)
        .single()

    const rawProfile = otherParticipant?.profiles
    const profileData = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
    const fallback = { username: 'Unknown User', id: 'unknown' }

    const targetProfile = {
        id: profileData?.id || fallback.id,
        username: profileData?.username || fallback.username
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col max-w-2xl mx-auto">
            <DirectMessageClient
                sessionId={sessionId}
                currentUser={user}
                targetProfile={targetProfile}
            />
        </div>
    )
}
