import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  
  // 1. Get User (Soft Check)
  // We utilize the Middleware to protect the route. 
  // We do NOT redirect here if 'user' is null, because it might be a cookie sync delay.
  const { data: { user } } = await supabase.auth.getUser()

  // If there is really no user, the Client Component (DashboardClient) 
  // or the Middleware will handle the kick. 
  // We just render the children to prevent a redirect loop.
  if (!user) {
    return <>{children}</>
  }

  // 2. Verify Profile Completeness
  // We only redirect if we are SURE we have a user but they have no profile.
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  // If user exists but has no username, send to setup
  if (profile && !profile.username) {
    redirect('/auth/setup')
  }

  return <>{children}</>
}
