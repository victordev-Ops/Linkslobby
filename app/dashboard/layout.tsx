//app/dashboard/layout.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  
  // 1. Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  // If no user, let middleware handle it (prevents redirect loops)
  if (authError || !user) {
    return <>{children}</>
  }

  // 2. Check profile completeness - use maybeSingle() to avoid errors
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, slug')
    .eq('id', user.id)
    .maybeSingle() // ✅ CRITICAL: Use maybeSingle() instead of single()

  // 3. Handle profile errors
  if (profileError) {
    console.error('Dashboard Layout - Profile fetch error:', profileError)
    // If there's a database error, redirect to setup to be safe
    redirect('/auth/setup')
  }

  // 4. If NO profile exists at all, redirect to setup
  if (!profile) {
    console.log('Dashboard Layout - No profile found, redirecting to setup')
    redirect('/auth/setup')
  }

  // 5. If profile exists but username/slug is missing, redirect to setup
  if (!profile.username || !profile.slug) {
    console.log('Dashboard Layout - Profile incomplete, redirecting to setup')
    redirect('/auth/setup')
  }

  // 6. Profile complete - render dashboard
  return <>{children}</>
}
