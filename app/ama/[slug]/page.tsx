//app/ama/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AmaPublicClient from '@/components/AmaPublicClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PublicAmaPage({ params }: PageProps) {
  const { slug } = await params // ✅ FIX: Await the params
  
  const supabase = await createSupabaseServerClient()
  
  // Fetch profile by slug
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, slug')
    .eq('slug', slug)
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
