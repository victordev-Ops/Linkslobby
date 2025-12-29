import { createSupabaseServerClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
// REMOVE: import { unstable_cache } from 'next/cache'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile = null
  
  if (user) {
    // DIRECT FETCH: No caching wrapper needed for this simple query
    const { data } = await supabase
      .from('profiles')
      .select('username, slug')
      .eq('id', user.id)
      .single()

    profile = data ?? { username: 'Anonymous', slug: 'anonymous' }
  }

  const slug = profile?.slug ?? 'anonymous'
  const confessUrl = `https://say-app.vercel.app/confess/${slug}`

  return (
    <DashboardClient
      user={user}
      profile={profile}
      confessUrl={confessUrl}
    />
  )
      }
      
