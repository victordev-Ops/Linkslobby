import DashboardClient from './DashboardClient'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  // User and profile completeness are guaranteed by middleware
  // Just get the session for the user ID
  const { data: { session } } = await supabase.auth.getSession()

  // This shouldn't happen since middleware protects this route,
  // but TypeScript needs the check
  if (!session) {
    throw new Error('Session not found')
  }

  const userId = session.user.id

  // Get Profile & Dykm Data in parallel for speed
  const [profileResponse, dykmResponse] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, slug, avatar_url')
      .eq('id', userId)
      .single(), // Use single() since middleware guarantees profile exists
    supabase
      .from('dykm_quizzes')
      .select('questions')
      .eq('user_id', userId)
      .maybeSingle()
  ])

  if (profileResponse.error) {
    console.error('Profile fetch error:', profileResponse.error)
    throw new Error('Failed to load user profile')
  }

  const profile = profileResponse.data
  const dykmData = dykmResponse.data

  return (
    <DashboardClient
      serverProfile={profile}
      initialDykmQuestions={dykmData?.questions}
    />
  )
}
