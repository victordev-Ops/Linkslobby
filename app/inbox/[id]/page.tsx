// app/inbox/[id]/page.tsx
import { supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MessageViewClient from '@/components/MessageViewClient'

export const dynamic = 'force-dynamic' // Keeps it fresh on every view

export default async function MessageViewPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await supabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/dashboard')
  }

  const { data: confession, error } = await supabase
    .from('confessions')
    .select('id, message, created_at, is_read, profile_id')
    .eq('id', params.id)
    .eq('profile_id', user.id)
    .single()

  if (error || !confession) {
    redirect('/inbox')
  }

  // Mark as read on the server (reliable + instant)
  if (!confession.is_read) {
    await supabase
      .from('confessions')
      .update({ is_read: true })
      .eq('id', params.id)

    // Optional: trigger client refresh for badge counts elsewhere
    // revalidatePath('/inbox') // if you use caching later
  }

  // Fetch username/slug for share link
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, slug')
    .eq('id', user.id)
    .single()

  const username = profile?.username || profile?.slug || 'you'

  return (
    <MessageViewClient
      confession={confession}
      username={username}
    />
  )
      }
