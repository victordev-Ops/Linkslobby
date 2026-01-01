// app/inbox/page.tsx
import { Suspense } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboxClient from '@/components/InboxClient'
import InboxSkeleton from '@/components/InboxSkeleton'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<InboxSkeleton />}>
        <ConfessionsLoader userId={user.id} />
      </Suspense>
    </div>
  )
}

async function ConfessionsLoader({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient()
  
  const { data: confessions } = await supabase
    .from('confessions')
    .select('id, message, created_at, is_read, profile_id')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })

  return (
    <InboxClient
      initialConfessions={confessions || []}
      userId={userId}
    />
  )
      }
      
