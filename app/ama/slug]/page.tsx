import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AmaPublicClient from '@/components/AmaPublicClient'

export const dynamic = 'force-dynamic'

export default async function PublicAmaPage({ 
  params 
}: { 
  params: { slug: string } 
}) {
  const supabase = await createSupabaseServerClient()
  
  // Fetch profile by slug
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, slug')
    .eq('slug', params.slug)
    .single()

  if (error || !profile) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-[#7C3AED] flex flex-col items-center justify-center p-6">
      <AmaPublicClient 
        profileId={profile.id} 
        username={profile.username} 
      />
      
      <p className="mt-8 text-white/60 text-xs font-medium uppercase tracking-widest">
        Powered by Say App
      </p>
    </div>
  )
}
