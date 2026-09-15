import { Suspense } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboxClient from '@/components/InboxClient'
import InboxSkeleton from '@/components/InboxSkeleton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InboxPage() {
  const supabase = await createSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0a1e] transition-colors duration-300">
      <Suspense fallback={<InboxSkeleton />}>
        <ConfessionsLoader userId={user.id} supabase={supabase} />
      </Suspense>
    </div>
  )
}

async function ConfessionsLoader({
  userId,
  supabase
}: {
  userId: string
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
}) {
  // Fetch confessions and profile data. DM sessions are intentionally NOT
  // fetched here — an earlier attempt to prefetch them here made this whole
  // Suspense boundary wait on getSessions()'s extra round trips (participants,
  // profiles, friendships, unread counts), which held the InboxSkeleton
  // fallback up longer and made it look like the loader was stuck covering
  // the chat list. Sessions load client-side in InboxClient instead — the
  // flicker that was originally caused by that client-side load is fixed at
  // the merge layer there (cache never clobbers live data), so nothing is
  // lost by not blocking the initial server render on it.
  //
  // FIX: also fetch hidden_notifications (type 'confession'). The Notifications
  // page's trash icon soft-deletes a "New Confession" notification by inserting
  // a row here — it never touches the confessions table itself (see
  // deleteNotification in actions/notifications.ts) — so without this filter,
  // anything deleted from the bell page kept showing up here in the Inbox,
  // fully visible and still counted as unread by InboxClient's tabStats.
  const [confessionsRes, profileRes, hiddenRes] = await Promise.all([
    supabase
      .from('confessions')
      .select('id, message, created_at, is_read, profile_id, message_type')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('username, slug, restricted_words, show_watermark')
      .eq('id', userId)
      .single(),
    supabase
      .from('hidden_notifications')
      .select('notification_id')
      .eq('user_id', userId)
      .eq('notification_type', 'confession')
  ])

  if (confessionsRes.error) {
    console.error('Error fetching confessions:', confessionsRes.error)
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0a1e] flex items-center justify-center p-6 transition-colors">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 font-medium">Failed to load confessions</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Please check your connection.</p>
        </div>
      </div>
    )
  }

  if (hiddenRes.error) {
    console.error('Error fetching hidden_notifications:', hiddenRes.error)
  }

  const hiddenConfessionIds = new Set((hiddenRes.data || []).map(h => h.notification_id))
  const visibleConfessions = (confessionsRes.data || []).filter(c => !hiddenConfessionIds.has(c.id))

  // Determine the display name for the share cards
  const username = profileRes.data?.username || profileRes.data?.slug || 'user'
  const restrictedWords: string[] = profileRes.data?.restricted_words || []
  const showWatermark = profileRes.data?.show_watermark ?? true

  return (
    <InboxClient
      initialConfessions={visibleConfessions}
      userId={userId}
      username={username}
      restrictedWords={restrictedWords}
      showWatermark={showWatermark}
    />
  )
}
