// app/inbox/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboxClient from '@/components/InboxClient'

// FIX: Force the page to be dynamic so it fetches fresh data on every visit
export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/dashboard')
  }

  // This query will now run every time the page is loaded
  const { data: confessions, error } = await supabase
    .from('confessions')
    .select('id, message, created_at, is_read, profile_id')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <InboxClient
      initialConfessions={confessions || []}
      userId={user.id}
    />
  )
}
  
