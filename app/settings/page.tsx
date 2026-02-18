import { createSupabaseServerClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
import { getBlockedUsers } from '@/actions/blocked-users'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  let username = 'Anonymous'
  let initialPushEnabled = false
  let restrictedWords: string[] = []
  let blockedUsers: Awaited<ReturnType<typeof getBlockedUsers>> = []

  if (user) {
    const [profileResult, blockedResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, push_subscription, restricted_words')
        .eq('id', user.id)
        .single(),
      getBlockedUsers(),
    ])

    const data = profileResult.data
    if (data?.username) username = data.username
    initialPushEnabled = !!data?.push_subscription
    restrictedWords = data?.restricted_words || []
    blockedUsers = blockedResult
  }

  return (
    <SettingsClient
      initialUser={user}
      initialUsername={username}
      initialPushEnabled={initialPushEnabled}
      initialRestrictedWords={restrictedWords}
      initialBlockedUsers={blockedUsers}
    />
  )
}
