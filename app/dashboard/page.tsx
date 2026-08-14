import { headers } from 'next/headers'
import DashboardClient from './DashboardClient'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type ServerProfile = {
  id: string
  username: string | null
  slug: string | null
  avatar_url: string | null
  is_pro: boolean | null
}

export default async function DashboardPage() {
  // Middleware already ran supabase.auth.getUser() (server-verified, not a
  // local JWT decode) AND queried `profiles` to confirm this user has a
  // complete profile — that's the only reason this route was allowed to
  // render at all. It forwards that exact row via the `x-user-profile`
  // header (see middleware.ts step 5), so re-checking the session with
  // getSession() and re-querying `profiles` here would just be paying for
  // the same round trips twice on every single dashboard load.
  const h = await headers()
  const profileHeader = h.get('x-user-profile')

  if (!profileHeader) {
    // Should be unreachable: middleware's matcher covers this route and
    // guarantees the header is set for any authenticated request that
    // reaches here. If this fires, middleware isn't running as expected
    // (e.g. matcher misconfigured) rather than this being a normal
    // "logged out" case — middleware would have redirected before this
    // page ever rendered.
    throw new Error('Missing x-user-profile header — request did not pass through middleware as expected')
  }

  const profile: ServerProfile = JSON.parse(profileHeader)
  const userId = profile.id

  const supabase = await createSupabaseServerClient()

  // Only remaining DB call this page needs to make itself.
  const { data: dykmData, error: dykmError } = await supabase
    .from('dykm_quizzes')
    .select('questions')
    .eq('user_id', userId)
    .maybeSingle()

  if (dykmError) {
    console.error('Dykm fetch error:', dykmError)
  }

  return (
    <DashboardClient
      serverProfile={profile}
      initialDykmQuestions={dykmData?.questions}
    />
  )
}
