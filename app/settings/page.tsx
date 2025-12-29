import { createSupabaseServerClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
// REMOVE: import { unstable_cache } from 'next/cache'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  let username = 'Anonymous'

  // DIRECT FETCH: Get the username directly
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    
    if (data?.username) {
      username = data.username
    }
  }

  return (
    <SettingsClient
      initialUser={user}
      initialUsername={username}
    />
  )
}
