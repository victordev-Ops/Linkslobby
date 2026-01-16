// app/confess/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ConfessionForm from './ConfessionForm'

// Ensure dynamic rendering
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug?: string }>
}

// Server Action for handling the confession
export async function sendConfessionAction(profileId: string, formData: FormData) {
  'use server'

  const supabase = await createSupabaseServerClient()
  const message = (formData.get('message') as string)?.trim()

  // Server-side validation
  if (!message || message.length < 1 || message.length > 1000) {
    return { error: 'Message must be between 1 and 1000 characters.' }
  }

  const { error: insertError } = await supabase
    .from('confessions')
    .insert({
      profile_id: profileId,
      message,
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

  return (
    // Background: Dark minimal with a subtle purple gradient glow
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-neutral-950 text-neutral-200">
      
      {/* Background Ambience (Purple Orb) */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-900/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="z-10 w-full max-w-lg px-4">
        {/* Glassmorphic Card */}
        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/5">
          
          {/* Header */}
          <div className="p-8 pb-2 text-center">
            <div className="inline-block p-3 rounded-full bg-purple-500/10 mb-4 border border-purple-500/20">
              <span className="text-2xl">🔒</span>
            </div>
            <h1 className="text-2xl font-light tracking-wide text-white">
              Send a message to <span className="font-bold text-purple-400">@{profile.username}</span>
            </h1>
            <p className="mt-3 text-sm text-neutral-400 font-light">
              Your identity is hidden. Be honest, be kind.
            </p>
          </div>

          {/* Form Container */}
          <div className="p-8 pt-6">
            <ConfessionForm 
              profileId={profile.id} 
              action={sendConfessionAction} 
            />
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-8 text-center">
          <Link
            href="/sign-up"
            className="group inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-purple-400 transition-colors duration-300"
          >
            <span>Want to receive anonymous messages?</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
