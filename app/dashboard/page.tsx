// app/dashboard/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
  // Dynamic cache key: unique per user
  (userId: string) => [`dashboard-profile-${userId}`],
  {
    revalidate: 3600, // 1 hour
    tags: ['profile'], // You can make this user-specific too if desired: ['profile', `profile-${userId}`]
  }
)

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Optional: redirect unauthenticated users
  // if (!user) redirect('/login')

  let profile = null
  if (user) {
    profile = await getCachedProfile(user.id)
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
