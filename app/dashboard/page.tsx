import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Gatekeeping: Redirect if not logged in
  if (!user) {
    redirect('/login')
  }

  // No need to pass props anymore!
  return <DashboardClient />
}
