// app/settings/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'
import { unstable_cache } from 'next/cache'

const getCachedUsername = unstable_cache(
  async (userId: string) => {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()

    return data?.username || 'Anonymous'
  },
  ['settings-username'],
  {
    revalidate: 3600, // 1 hour cache — usernames change rarely
    tags: ['username'],
  }
)

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Optional: redirect unauthenticated users
  // if (!user) redirect('/login')

  const username = user ? await getCachedUsername(user.id) : 'Anonymous'

  return (
    <SettingsClient
      initialUser={user}
      initialUsername={username}
      // Pass searchParams if needed on server (rare)
    />
  )
}
