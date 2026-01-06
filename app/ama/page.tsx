import { Suspense } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AmaGenerator from '@/components/AmaGenerator'

export default async function AmaPage() {
  const supabase = await createSupabaseServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/dashboard')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50"/>}>
      <AmaGenerator username={profile.username} />
    </Suspense>
  )
      }
