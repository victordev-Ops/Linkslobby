// app/anonymous/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import AnonymousForm from './AnonymousForm'
import VerifiedBadge from '@/components/VerifiedBadge'
import AdsterraDelayedSlot from '@/components/ads/AdsterraDelayedSlot'
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug?: string }>
}

export async function sendAnonymousAction(profileId: string, formData: FormData) {
  'use server'

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const message = (formData.get('message') as string)?.trim()

  // Count by grapheme cluster (Intl.Segmenter), matching the client exactly.
  // Array.from()/code-point counting would disagree with the client on
  // compound emoji (ZWJ sequences, skin-tone modifiers, flags) since those
  // are multiple code points but a single perceived character — using the
  // same segmentation on both sides means this check can never reject a
  // message the client already accepted, or vice versa.
  const messageLength = message
    ? Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(message)).length
    : 0

  if (!message || messageLength < 1) {
    return { error: 'Write something before sending.' }
  }
  if (messageLength > 1000) {
    return { error: `Message is too long by ${messageLength - 1000} characters.` }
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
      message_type: 'anonymous'
    })

  if (insertError) {
    return { error: 'Failed to send your message. Please try again.' }
  }

  return { success: true }
}

export default async function AnonymousPage({ params }: PageProps) {
  const { slug: rawSlug } = await params
  const slug = rawSlug?.trim().toLowerCase()

  if (!slug) notFound()

  const supabase = await createSupabaseServerClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, slug, is_pro, avatar_url')
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
    <div className="min-h-screen bg-indigo-600 relative overflow-hidden flex flex-col items-center justify-center p-6">
      {/* Ambient floating glow blobs for a lively, game-y backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 w-72 h-72 bg-purple-500/40 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-fuchsia-400/30 rounded-full blur-3xl animate-float-slower" />
        <div className="absolute -bottom-24 left-1/4 w-64 h-64 bg-indigo-400/40 rounded-full blur-3xl animate-float-slow" />
      </div>

      <div className="w-full max-w-sm relative">

        {/* White card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-card-in">

          {/* Card header */}
          <div className="px-6 pt-8 pb-6 text-center">
            {/* Eyebrow badge */}
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                 Anonymous message 
              </span>
            </div>

            {/* Avatar */}
            <div className="flex justify-center mb-4">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-16 h-16 rounded-full object-cover ring-4 ring-indigo-100"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center ring-4 ring-indigo-100">
                  <span className="text-white font-black text-2xl">
                    {profile.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {/* Username + badge */}
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <h1 className="text-lg font-black text-gray-900">
                {profile.username}
              </h1>
              {profile.is_pro && (
                <VerifiedBadge size={18} />
              )}
            </div>
            <p className="text-gray-400 text-sm font-medium">
              Got something to say? Stay anonymous 🤫
            </p>
          </div>

          {/* Form */}
          <div className="px-6 pb-8">
            <AnonymousForm
              profileId={profile.id}
              isBlocked={isBlocked}
              action={sendAnonymousAction}
            />
          </div>
        </div>

        {/* Adsterra native banner — mounts 6s after this page loads */}
        <div className="mt-6">
          <AdsterraDelayedSlot delayMs={3000} className="[&_span]:text-white/50" cycle />
        </div>

        <p className="mt-6 text-white/50 text-xs font-medium uppercase tracking-widest text-center">
          Powered by linkslobby
        </p>
      </div>

      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -25px) scale(1.08); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, 20px) scale(1.1); }
        }
        .animate-float-slow {
          animation: float-slow 9s ease-in-out infinite;
        }
        .animate-float-slower {
          animation: float-slower 12s ease-in-out infinite;
        }

        @keyframes card-in {
          0% { opacity: 0; transform: translateY(16px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-card-in {
          animation: card-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </div>
  )
    }

    
