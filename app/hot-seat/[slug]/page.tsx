import { createSupabaseServerClient } from '@/lib/supabase/server'
import ClientRedirect from '@/components/ClientRedirect'
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

    // Don't call redirect() here — it aborts the response with a 307 before
    // this route's OG metadata is ever sent, which is why link previews
    // were broken. Render normally and redirect client-side after mount
    // instead, so crawlers see the page + its metadata while real
    // signed-out users still get bounced to /login right away.
    if (!user) return <ClientRedirect to={`/login?next=/hot-seat/${slug}`} />

    // Fetch session
    const { data: session } = await supabase
        .from('hot_seat_sessions')
        .select(`
            *,
            host:profiles!hot_seat_sessions_host_id_fkey(username, slug, id)
        `)
        .eq('slug', slug)
        .single()

    if (!session) return <ClientRedirect to="/hot-seat" />

    // Fetch user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (!profile) return <ClientRedirect to="/auth/setup" />

    return <HotSeatGameClient session={session} userProfile={profile} />
}
