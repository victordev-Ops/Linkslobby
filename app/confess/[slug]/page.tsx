// app/confess/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ConfessionForm from './ConfessionForm'
import { graphemeLength } from '@/lib/graphemes'
import AdsterraDelayedSlot from '@/components/ads/AdsterraDelayedSlot'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug?: string }>
}

const CONFESSION_MAX_CHARS = 1000

export async function sendConfessionAction(profileId: string, formData: FormData) {
  'use server'

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const message = (formData.get('message') as string)?.trim()

  // Count by grapheme cluster (Intl.Segmenter), matching the client's live
  // counter exactly — see lib/graphemes.ts. This can never reject a message
  // the client already accepted, or vice versa, even with compound emoji.
  const messageLength = message ? graphemeLength(message) : 0

  if (!message || messageLength < 1) {
    return { error: 'Write something before sending.' }
  }
  if (messageLength > CONFESSION_MAX_CHARS) {
    return { error: `Message is too long by ${messageLength - CONFESSION_MAX_CHARS} characters.` }
  }

  const headersList = await headers()
  const ua = headersList.get('user-agent') || 'unknown'
  const lang = headersList.get('accept-language') || 'unknown'
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const referrer = headersList.get('referer') || 'direct'

  const { isAnonymousBlocked, isUserBlocked } = await import('@/actions/blocked-users')

  const ipBlocked = await isAnonymousBlocked(profileId, ip)
  if (ipBlocked) return { error: 'Unable to deliver your message.' }

  if (user) {
    const userBlocked = await isUserBlocked(profileId, user.id)
    if (userBlocked) return { error: 'Unable to deliver your message.' }
  }

  const metadata = JSON.stringify({ ua, lang, ip, t: Date.now(), ref: referrer })
  const messageWithMeta = `${message}\n\n[META:${metadata}]`

  const { error: insertError } = await supabase
    .from('confessions')
    .insert({
      profile_id: profileId,
      sender_id: user?.id || null,
      message: messageWithMeta,
      message_type: 'confession'
    })

  if (insertError) {
    console.error('Submission error:', insertError)
    return { error: 'Failed to deliver. Please try again.' }
  }

  return { success: true }
}

export default async function ConfessPage({ params }: PageProps) {
  const { slug: rawSlug } = await params
  const slug = rawSlug?.trim().toLowerCase()

  if (!slug) notFound()

  const supabase = await createSupabaseServerClient()

  // is_verified does not exist in the schema — select only real columns
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, slug, is_pro')
    .eq('slug', slug)
    .single()

  if (profileError || !profile) notFound()

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { data: { user } } = await supabase.auth.getUser()
  const { isAnonymousBlocked, isUserBlocked } = await import('@/actions/blocked-users')

  let isBlocked = await isAnonymousBlocked(profile.id, ip)
  if (!isBlocked && user) {
    isBlocked = await isUserBlocked(profile.id, user.id)
  }

  return (
    <div className="min-h-screen bg-purple-600 flex flex-col items-center justify-center p-6">
      <ConfessionForm
        profileId={profile.id}
        username={profile.username ?? slug}
        isPro={profile.is_pro ?? false}
        isBlocked={isBlocked}
        action={sendConfessionAction}
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
