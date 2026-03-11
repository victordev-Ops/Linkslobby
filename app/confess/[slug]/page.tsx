// app/confess/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ConfessionForm from './ConfessionForm'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug?: string }>
}

/**
 * SERVER ACTION: Delivers the message
 */
export async function sendConfessionAction(profileId: string, formData: FormData) {
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

  // Block Enforcement (System Level)
  const { isAnonymousBlocked, isUserBlocked } = await import('@/actions/blocked-users')

  // 1. IP Block check
  const ipBlocked = await isAnonymousBlocked(profileId, ip)
  if (ipBlocked) {
    return { error: 'Unable to deliver your message.' }
  }

  // 2. User ID Block check (if authenticated)
  if (user) {
    const userBlocked = await isUserBlocked(profileId, user.id)
    if (userBlocked) {
      return { error: 'Unable to deliver your message.' }
    }
  }

  const metadata = JSON.stringify({ ua, lang, ip, t: Date.now(), ref: referrer })
  const messageWithMeta = `${message}\n\n[META:${metadata}]`

  const { error: insertError } = await supabase
    .from('confessions')
    .insert({
      profile_id: profileId,
      sender_id: user?.id || null, // Track sender if authenticated
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

  // Fetch the profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, slug')
    .eq('slug', slug)
    .single()

  if (profileError || !profile) notFound()

  // Block Check for UI
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { data: { user } } = await supabase.auth.getUser()
  const { isAnonymousBlocked, isUserBlocked } = await import('@/actions/blocked-users')

  let isBlocked = await isAnonymousBlocked(profile.id, ip)
  if (!isBlocked && user) {
    isBlocked = await isUserBlocked(profile.id, user.id)
  }

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-neutral-950 text-neutral-200">

      {/* Background Ambience (Mobile Optimized Orbs) */}
      <div className="absolute top-[-10%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-purple-900/20 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-indigo-900/10 rounded-full blur-[70px] md:blur-[100px] pointer-events-none" />

      {/* Subtle mid-screen glow to give the card something to blur against */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[320px] h-[320px] bg-purple-700/10 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 w-full max-w-lg px-4 py-8">

        {/* Outer Card — deep glass layer */}
        <div className="relative backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden ring-1 ring-white/5">

          {/* Specular top-edge highlight — mimics light catching glass */}
          <div className="absolute top-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          {/* Inner radial glow behind the header content */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[180px] bg-purple-600/10 rounded-full blur-[60px] pointer-events-none" />

          {/* Header */}
          <div className="relative p-8 pb-2 text-center">

            {/* Icon badge — frosted inner glass */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                            backdrop-blur-md bg-purple-500/10 border border-purple-500/20
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_24px_rgba(139,92,246,0.12)]
                            mb-6">
              <span className="text-2xl">🔒</span>
            </div>

            <h1 className="text-2xl font-light tracking-tight text-white">
              Send a secret to{' '}

              {/*
                @username pill — the focal glass element.
                Layered: frosted bg + purple tint + inner highlight + soft glow ring.
                Uses inline-flex so it wraps naturally within the sentence flow.
              */}
              <span className="
                inline-flex items-center
                mx-1 px-3 py-0.5
                rounded-xl
                backdrop-blur-md
                bg-purple-500/10
                border border-purple-400/25
                shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_0_18px_rgba(139,92,246,0.18)]
                font-bold text-purple-300
                transition-all duration-300
                hover:bg-purple-500/20 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_28px_rgba(139,92,246,0.30)]
              ">
                @{profile.username}
              </span>
            </h1>

            <p className="mt-3 text-sm text-neutral-400 font-light leading-relaxed">
              Your identity is hidden. <br className="hidden sm:block" /> Be honest, be kind.
            </p>
          </div>

          {/* Divider — a fine glass seam between header and form */}
          <div className="mx-8 mt-6 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

          {/* Form Container — slightly elevated inner glass panel */}
          <div className="relative m-3 mt-0 rounded-[2rem] backdrop-blur-sm bg-white/[0.02] border border-white/[0.06]
                          shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">

            {/* Bottom-edge specular for the inner panel */}
            <div className="absolute bottom-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none rounded-full" />

            <div className="p-6">
              <ConfessionForm
                profileId={profile.id}
                isBlocked={isBlocked}
                action={sendConfessionAction}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
