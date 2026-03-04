// app/confess/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ConfessionForm from './AnonymousForm'

// Ensure dynamic rendering
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug?: string }>
}

// Server Action for handling the confession
export async function sendConfessionAction(profileId: string, formData: FormData) {
  'use server'

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const message = (formData.get('message') as string)?.trim()

  // Server-side validation
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
      message_type: 'anonymous'
    })

  if (insertError) {
    console.error('Submission error:', insertError)
    return { error: 'Failed to deliver your confession. Please try again.' }
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
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-neutral-950 text-neutral-200">

      {/* Background Ambience (Slate Glow) */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-slate-900/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-gray-900/30 rounded-full blur-[100px] pointer-events-none" />

      <div className="z-10 w-full max-w-lg px-4">
        {/* Glassmorphic Card */}
        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/5">

          {/* Header */}
          <div className="p-8 pb-2 text-center">
            <div className="inline-block p-3 rounded-full bg-slate-500/10 mb-4 border border-slate-500/20 text-slate-400 flex items-center justify-center shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 10h.01" /><path d="M15 10h.01" /><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" /></svg>
            </div>
            <h1 className="text-2xl font-light tracking-wide text-white">
              Send a message to <span className="font-bold text-slate-300">@{profile.username}</span>
            </h1>
            <p className="mt-3 text-sm text-neutral-400 font-light">
              Your identity is hidden. Be honest, be kind.
            </p>
          </div>

          {/* Form Container */}
          <div className="p-8 pt-6">
            <ConfessionForm
              profileId={profile.id}
              isBlocked={isBlocked}
              action={sendConfessionAction}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
