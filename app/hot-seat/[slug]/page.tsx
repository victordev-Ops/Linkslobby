import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HotSeatGameClient from './HotSeatGameClient'

interface PageProps {
    params: Promise<{ slug: string }>
}

export default async function HotSeatSessionPage({ params }: PageProps) {
    const { slug } = await params
    const supabase = await createSupabaseServerClient()

    // Get current user (can be anon/null if not logged in?) - actually we probably require auth for chat
    // But let's check auth status
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect(`/login?next=/hot-seat/${slug}`)

    // Fetch session
    const { data: session } = await supabase
        .from('hot_seat_sessions')
        .select(`
            *,
            host:profiles!hot_seat_sessions_host_id_fkey(username, slug, id)
        `)
        .eq('slug', slug)
        .single()

    if (!session) redirect('/hot-seat')

    // Fetch user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (!profile) redirect('/auth/setup')

    return <HotSeatGameClient session={session} userProfile={profile} />
}
