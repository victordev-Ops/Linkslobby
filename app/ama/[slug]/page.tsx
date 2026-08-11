import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AmaPublicClient from '@/components/AmaPublicClient'
import AdsterraDelayedSlot from '@/components/ads/AdsterraDelayedSlot'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PublicAmaPage({ params }: PageProps) {
  const { slug } = await params

  const supabase = await createSupabaseServerClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, slug, is_pro')
    .eq('slug', slug)
    .single()

  if (error || !profile) {
    notFound()
  }

  const { headers } = await import('next/headers')
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { data: { user } } = await supabase.auth.getUser()
  const { isAnonymousBlocked, isUserBlocked } = await import('@/actions/blocked-users')

  let isBlocked = await isAnonymousBlocked(profile.id, ip)
  if (!isBlocked && user) {
    isBlocked = await isUserBlocked(profile.id, user.id)
  }

  return (
    <div className="min-h-screen bg-[#EA580C] flex flex-col items-center justify-center p-6">
      <AmaPublicClient
        profileId={profile.id}
        username={profile.username}
        isPro={profile.is_pro}
        isBlocked={isBlocked}
      />

      <div className="mt-6 w-full max-w-md">
        <AdsterraDelayedSlot
          delayMs={6000}
          className="[&_span]:text-white/50"
          cycle
          maxHeightPx={155}
        />
      </div>

      <p className="mt-8 text-white/60 text-xs font-medium uppercase tracking-widest">
        Powered by Linkslobby
      </p>
    </div>
  )
      }
