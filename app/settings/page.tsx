import { createSupabaseServerClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
import { getBlockedUsers, getBlockedAnonymous } from '@/actions/blocked-users'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  let avatarUrl: string | null = null
  let username = 'Anonymous'
  let initialPushEnabled = false
  let restrictedWords: string[] = []
  let blockedUsers: any[] = []
  let blockedAnonymous: any[] = []

  if (user) {
    const [profileResult, blockedResult, blockedAnonResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, push_subscription, restricted_words, avatar_url')
        .eq('id', user.id)
        .single(),
      getBlockedUsers(),
      getBlockedAnonymous(),
    ])

    const data = profileResult.data
    if (data?.username) username = data.username
    initialPushEnabled = !!data?.push_subscription
    restrictedWords = data?.restricted_words || []
    blockedUsers = blockedResult
    blockedAnonymous = blockedAnonResult
    avatarUrl = data?.avatar_url
  }

  return (
    <SettingsClient
      initialUser={user}
      initialUsername={username}
      initialAvatarUrl={avatarUrl}
      initialPushEnabled={initialPushEnabled}
      initialRestrictedWords={restrictedWords}
      initialBlockedUsers={blockedUsers}
      initialBlockedAnonymous={blockedAnonymous}
    />
  )
}
