// app/three-word/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ThreeWordForm from './ThreeWordForm'
import { submitThreeWordResponse } from '@/actions/three-word'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug?: string }>
}

export default async function ThreeWordPage({ params }: PageProps) {
  const { slug: rawSlug } = await params
  const slug = rawSlug?.trim().toLowerCase()

  if (!slug) notFound()

  const supabase = await createSupabaseServerClient()

  const { data: session, error: sessionError } = await supabase
    .from('three_word_sessions')
    .select('id, host_id, status')
    .eq('slug', slug)
    .single()

  if (sessionError || !session) notFound()

  const { data: host, error: hostError } = await supabase
    .from('profiles')
    .select('id, username, slug, avatar_url, is_pro')
    .eq('id', session.host_id)
    .single()

  if (hostError || !host) notFound()

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { data: { user } } = await supabase.auth.getUser()
  const { isAnonymousBlocked, isUserBlocked } = await import('@/actions/blocked-users')

  let isBlocked = await isAnonymousBlocked(host.id, ip)
  if (!isBlocked && user) {
    isBlocked = await isUserBlocked(host.id, user.id)
  }

  // TODO(analytics): track('Link Opened', { game: 'three_word' }) — server-side
  // event, fire through whichever analytics call the project's other
  // page.tsx files already use for pageview-style tracking (if any).

  return (
    <div className="min-h-screen bg-cyan-600 flex flex-col items-center justify-center p-6">
      <ThreeWordForm
        slug={slug}
        username={host.username ?? host.slug}
        avatarUrl={host.avatar_url}
        isPro={host.is_pro ?? false}
        isBlocked={isBlocked}
        isClosed={session.status !== 'active'}
        action={submitThreeWordResponse}
      />

      <p className="mt-8 text-white/60 text-xs font-medium uppercase tracking-widest">
        Powered by Linkslobby
      </p>
    </div>
  )
}
