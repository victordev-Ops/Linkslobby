// app/confess/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
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
  const message = (formData.get('message') as string)?.trim()

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

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-neutral-950 text-neutral-200">
      
      {/* Background Ambience (Mobile Optimized Orbs) */}
      <div className="absolute top-[-10%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-purple-900/20 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-indigo-900/10 rounded-full blur-[70px] md:blur-[100px] pointer-events-none" />

      <div className="z-10 w-full max-w-lg px-4 py-8">
        {/* Glassmorphic Card */}
        <div className="relative backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden ring-1 ring-white/10">
          
          {/* Header */}
          <div className="p-8 pb-2 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 mb-6 border border-purple-500/20 shadow-inner">
              <span className="text-2xl">🔒</span>
            </div>
            <h1 className="text-2xl font-light tracking-tight text-white">
              Send a secret to <span className="font-bold text-purple-400 italic">@{profile.username}</span>
            </h1>
            <p className="mt-3 text-sm text-neutral-400 font-light leading-relaxed">
              Your identity is hidden. <br className="hidden sm:block" /> Be honest, be kind.
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
            href="/signup"
            className="group inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase text-neutral-500 hover:text-purple-400 transition-all duration-300"
          >
            <span>Create your own page</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
