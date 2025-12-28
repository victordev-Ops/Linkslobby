// app/inbox/page.tsx
import { supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboxClient from '@/components/InboxClient'

export const dynamic = 'force-dynamic' // Keeps data fresh; optional: use revalidate = 60 for caching

export default async function InboxPage() {
  const supabase = await supabaseServer()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/dashboard')
  }

  const { data: confessions, error } = await supabase
    .from('confessions')
    .select('id, message, created_at, is_read, profile_id')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching confessions:', error)
    // Optional: return an error state UI here
  }

  return (
    <InboxClient
      initialConfessions={confessions || []}
      userId={user.id}
    />
  )
}
