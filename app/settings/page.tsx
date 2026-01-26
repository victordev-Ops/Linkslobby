import { createSupabaseServerClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
// REMOVE: import { unstable_cache } from 'next/cache'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  let username = 'Anonymous'
  let initialPushEnabled = false

  // DIRECT FETCH: Get the username and push status directly
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('username, push_subscription')
      .eq('id', user.id)
      .single()

    if (data?.username) {
      username = data.username
    }
    initialPushEnabled = !!data?.push_subscription
  }

  return (
    <SettingsClient
      initialUser={user}
      initialUsername={username}
      initialPushEnabled={initialPushEnabled}
    />
  )
}
