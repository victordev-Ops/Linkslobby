// app/inbox/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboxClient from '@/components/InboxClient'

// Revalidate the page (and its data) every 60 seconds
export const revalidate = 60

// Optional: remove dynamic = 'force-dynamic' entirely (or comment it out)
// export const dynamic = 'force-dynamic'  // ← no longer needed

export default async function InboxPage() {
  const supabase = await createSupabaseServerClient()

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
    // You could return an error UI here if desired
  }

  return (
    <InboxClient
      initialConfessions={confessions || []}
      userId={user.id}
    />
  )
}
