import { Suspense } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboxClient from '@/components/InboxClient'
import InboxSkeleton from '@/components/InboxSkeleton'
import { getSessions } from '@/actions/chat'

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
  // Fetch confessions, profile data, and DM sessions together — previously
  // sessions were only ever fetched client-side, so the DM list started
  // empty on every load and popped in a beat later (part of the flicker
  // reported in the inbox).
  const [confessionsRes, profileRes, sessionsRes] = await Promise.all([
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
    getSessions()
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

  // Determine the display name for the share cards
  const username = profileRes.data?.username || profileRes.data?.slug || 'user'
  const restrictedWords: string[] = profileRes.data?.restricted_words || []
  const showWatermark = profileRes.data?.show_watermark ?? true

  return (
    <InboxClient
      initialConfessions={confessionsRes.data || []}
      initialSessions={sessionsRes.success ? (sessionsRes.data as any) : []}
      userId={userId}
      username={username}
      restrictedWords={restrictedWords}
      showWatermark={showWatermark}
    />
  )
}


