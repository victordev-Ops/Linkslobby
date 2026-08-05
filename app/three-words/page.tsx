// app/three-words/page.tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveThreeWordSession, getThreeWordResponses } from '@/actions/three-word'
import ThreeWordsClient from './ThreeWordsClient'

export const dynamic = 'force-dynamic'

export default async function ThreeWordsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, slug, is_pro')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // The dashboard card that links here is already gated behind
  // `profile.is_pro`, but the route itself needs the same check server-side
  // — a signed-in non-Pro user could otherwise hit /three-words directly.
  if (!profile.is_pro) redirect('/dashboard')

  const session = await getActiveThreeWordSession()
  const { responses, nextCursor } = session
    ? await getThreeWordResponses()
    : { responses: [], nextCursor: null }

  return (
    <ThreeWordsClient
      profileSlug={profile.slug}
      initialSession={session}
      initialResponses={responses}
      initialNextCursor={nextCursor}
    />
  )
}
