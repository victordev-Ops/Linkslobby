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
  // Fetch both confessions and profile data
  const [confessionsRes, profileRes] = await Promise.all([
    supabase
      .from('confessions')
      .select('id, message, created_at, is_read, profile_id')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('username, slug')
      .eq('id', userId)
      .single()
  ])

  if (confessionsRes.error) {
    console.error('Error fetching confessions:', confessionsRes.error)
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-600 font-medium">Failed to load confessions</p>
          <p className="text-sm text-gray-400 mb-4">Please check your connection.</p>
        </div>
      </div>
    )
  }

  // Determine the display name for the share cards
  const username = profileRes.data?.username || profileRes.data?.slug || 'user'

  return (
    <InboxClient
      initialConfessions={confessionsRes.data || []}
      userId={userId}
      username={username} // <--- This satisfies the TypeScript requirement
    />
  )
}


