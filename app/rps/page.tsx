import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RPSGameClient from './RPSGameClient'

export default async function RPSPage() {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, slug, is_pro')
        .eq('id', user.id)
        .single()

    if (!profile) redirect('/auth/setup')

    return <RPSGameClient profile={profile} />
}
