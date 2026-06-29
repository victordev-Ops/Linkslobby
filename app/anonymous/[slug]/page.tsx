// app/anonymous/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import AnonymousForm from './AnonymousForm'
import VerifiedBadge from '@/components/VerifiedBadge' 
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug?: string }>
}

export async function sendAnonymousAction(profileId: string, formData: FormData) {
  'use server'

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const message = (formData.get('message') as string)?.trim()

  if (!message || message.length < 1 || message.length > 1000) {
    return { error: 'Message must be between 1 and 1000 characters.' }
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
    <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* White card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Card header */}
          <div className="px-6 pt-8 pb-6 text-center">
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
    @{profile.username}
  </h1>
  {profile.is_pro && (
    <VerifiedBadge size={18} />
  )}
</div>
            <p className="text-gray-400 text-sm font-medium">
              Send an anonymous message
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

        <p className="mt-6 text-white/50 text-xs font-medium uppercase tracking-widest text-center">
          Powered by Say App
        </p>
      </div>
    </div>
  )
}
