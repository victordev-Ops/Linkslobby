import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HotSeatListClient from './HotSeatListClient'

export default async function HotSeatPage() {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, slug, is_pro')
        .eq('id', user.id)
        .single()

    if (!profile) redirect('/auth/setup')

    // Fetch active sessions
    const { data: sessions } = await supabase
        .from('hot_seat_sessions')
        .select(`
      *,
      host:profiles!hot_seat_sessions_host_id_fkey(username, slug),
      hot_seat_participants(count)
    `)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })
        .limit(20)

    return <HotSeatListClient profile={profile} sessions={sessions || []} />
}
