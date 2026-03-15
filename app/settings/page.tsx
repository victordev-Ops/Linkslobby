import { createSupabaseServerClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
import { getBlockedUsers, getBlockedAnonymous } from '@/actions/blocked-users'
import { getSubscriptionStatus } from '@/actions/subscription'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  let avatarUrl: string | null = null
  let username = 'Anonymous'
  let initialPushEnabled = false
  let initialShowWatermark = true
  let restrictedWords: string[] = []
  let blockedUsers: any[] = []
  let blockedAnonymous: any[] = []
  let subscriptionStatus = null
  let isPro = false

  if (user) {
    const [profileResult, blockedResult, blockedAnonResult, subResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, push_subscription, restricted_words, avatar_url, show_watermark, is_pro')
        .eq('id', user.id)
        .single(),
      getBlockedUsers(),
      getBlockedAnonymous(),
      getSubscriptionStatus(),
    ])

    const data = profileResult.data
    if (data?.username) username = data.username
    initialPushEnabled = !!data?.push_subscription
    initialShowWatermark = data?.show_watermark ?? true
    restrictedWords = data?.restricted_words || []
    blockedUsers = blockedResult
    blockedAnonymous = blockedAnonResult
    avatarUrl = data?.avatar_url
    isPro = !!data?.is_pro
    if (subResult.success) {
      subscriptionStatus = subResult.subscription
    }
  }

  return (
    <SettingsClient
      initialUser={user}
      initialUsername={username}
      initialAvatarUrl={avatarUrl}
      initialPushEnabled={initialPushEnabled}
      initialShowWatermark={initialShowWatermark}
      initialRestrictedWords={restrictedWords}
      initialBlockedUsers={blockedUsers}
      initialBlockedAnonymous={blockedAnonymous}
      initialSubscription={subscriptionStatus}
      isPro={isPro}
    />
  )
}
