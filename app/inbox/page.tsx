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
    <div className="min-h-screen bg-white">
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
  const { data: confessions, error } = await supabase
    .from('confessions')
    .select('id, message, created_at, is_read, profile_id')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching confessions:', error)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Failed to load confessions</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <InboxClient
      initialConfessions={confessions || []}
      userId={userId}
    />
  )
        }
