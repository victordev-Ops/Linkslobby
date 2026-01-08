// app/dashboard/layout.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  
  // 1. Get User (Soft Check)
  // We do NOT redirect if user is null here. We trust the Middleware.
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Handle Edge Case: Middleware passed, but something is wrong
  if (!user) {
    // Ideally, middleware catches this. If we are here, it's a sync issue.
    // We render the children (Client Component) which handles the final "kick" if needed.
    return <>{children}</> 
  }

  // 3. Verify Profile Completeness
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  // If user exists but has no username, send to setup
  if (user && (!profile || !profile.username)) {
    redirect('/auth/setup')
  }

  return <>{children}</>
}
