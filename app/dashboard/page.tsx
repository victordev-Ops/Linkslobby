import DashboardClient from './DashboardClient'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  // 1. Get User
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // 2. Get Profile & Dykm Data in parallel for speed
  const [profileResponse, dykmResponse] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, slug')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('dykm_quizzes')
      .select('questions')
      .eq('user_id', user.id)
      .maybeSingle()
  ])

  const profile = profileResponse.data
  const dykmData = dykmResponse.data

  // 3. Handle redirects if profile missing
  if (!profile || !profile.username || !profile.slug) {
    redirect('/auth/setup')
  }

  // 4. Render Client with Data
  return (
    <DashboardClient
      serverProfile={profile}
      initialDykmQuestions={dykmData?.questions}
    />
  )
}
