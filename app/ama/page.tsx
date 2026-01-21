import { Suspense } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AmaGenerator from '@/components/AmaGenerator'

export default async function AmaPage() {
  const supabase = await createSupabaseServerClient()

  // 1. Quick server-side check for a session
  const { data: { user } } = await supabase.auth.getUser()

  // If no user, redirect to login (or dashboard which handles login)
  if (!user) redirect('/login')

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f0a1e] flex items-center justify-center transition-colors">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      {/* Note: We no longer pass 'username' or 'slug' as props here.
        AmaGenerator will get them from useAuth() inside the component.
      */}
      <AmaGenerator />
    </Suspense>
  )
}
