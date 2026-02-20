import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getOrCreateSession } from '@/actions/chat'

interface PageProps {
    params: Promise<{
        username: string
    }>
}

export default async function MessageUsernamePage({ params }: PageProps) {
    const { username } = await params
    const decodedUsername = decodeURIComponent(username).replace(/^@/, '')
    const supabase = await createSupabaseServerClient()

    // 1. Get User by Username
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', decodedUsername)
        .single()

    if (!profile) return notFound()

    // 2. Get or Create Session
    const result = await getOrCreateSession(profile.id)

    if (result.success && result.sessionId) {
        redirect(`/messages/${result.sessionId}`)
    } else {
        // Fallback or error page
        console.error('Failed to get session:', result)
        // For now, redirect to inbox or show error
        redirect('/inbox')
    }
}
