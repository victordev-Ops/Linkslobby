import { createSupabaseServerClient } from '@/lib/supabase/server'
import ClientRedirect from '@/components/ClientRedirect'
import RPSGameClient from './RPSGameClient'

export default async function RPSPage() {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Don't call redirect() here — it aborts the response with a 307 before
    // this route's OG metadata is ever sent. Render normally and redirect
    // client-side after mount instead, so crawlers see the page + its
    // metadata while real signed-out users still get bounced to /login.
    if (!user) return <ClientRedirect to="/login" />

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, slug, is_pro')
        .eq('id', user.id)
        .single()

    if (!profile) return <ClientRedirect to="/auth/setup" />

    return <RPSGameClient profile={profile} />
        }
