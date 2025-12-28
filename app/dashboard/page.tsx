import { createSupabaseServerClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import { unstable_cache } from 'next/cache'

const getCachedProfile = unstable_cache(
  async (userId: string) => {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase
      .from('profiles')
      .select('username, slug')
      .eq('id', userId)
      .single()

    return data ?? { username: 'Anonymous', slug: 'anonymous' }
  },
  ['dashboard-profile'],
  {
    revalidate: 3600,
    tags: ['profile'],
  }
)

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    profile = await getCachedProfile(user.id)  // ← Only one argument
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
