// app/inbox/[id]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MessageViewClient from '@/components/MessageViewClient'

export const dynamic = 'force-dynamic'

// 1. Update the type definition to wrap params in Promise
export default async function MessageViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // 2. Await the params to get the actual ID
  const { id } = await params

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/dashboard')
  }

  const { data: confession, error } = await supabase
    .from('confessions')
    .select('id, message, created_at, is_read, profile_id, message_type')
    .eq('id', id) // 3. Use the awaited 'id' variable here
    .eq('profile_id', user.id)
    .single()

  if (error || !confession) {
    redirect('/inbox')
  }



  const { data: profile } = await supabase
    .from('profiles')
    .select('username, slug, restricted_words')
    .eq('id', user.id)
    .single()

  const username = profile?.username || profile?.slug || 'you'
  const restrictedWords: string[] = (profile as any)?.restricted_words || []

  return (
    <MessageViewClient
      confession={confession}
      username={username}
      restrictedWords={restrictedWords}
    />
  )
}

