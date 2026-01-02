// app/confess/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import ConfessionForm from './ConfessionForm'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug?: string }>
  searchParams: Promise<{ status?: string; error?: string }>
}

async function sendConfession(profileId: string, slug: string, formData: FormData) {
  'use server'

  const supabase = await createSupabaseServerClient()

  const message = (formData.get('message') as string)?.trim()

  if (!message || message.length < 1 || message.length > 1000) {
    redirect(`/confess/${slug}?error=Message must be 1–1000 characters`)
  }

  const { error: insertError } = await supabase
    .from('confessions')
    .insert({
      profile_id: profileId,
      message,
    })

  if (insertError) {
    redirect(`/confess/${slug}?error=Failed to send confession`)
  }

  redirect(`/confess/${slug}?status=success`)
}

export default async function ConfessPage({ params, searchParams }: PageProps) {
  const { slug: rawSlug } = await params
  const { status, error: urlError } = await searchParams

  const slug = rawSlug?.trim().toLowerCase()

  if (!slug) notFound()

  const supabase = await createSupabaseServerClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, slug')
    .eq('slug', slug)
    .single()

  if (profileError || !profile) notFound()

  const { id: profileId, username } = profile

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-800">@{username}</h1>
            <p className="mt-4 text-xl text-gray-700">Send me anonymous messages!</p>
            <p className="mt-2 text-lg text-gray-600">🔒 anonymous confession</p>
          </div>

          {/* Body */}
          <div className="px-8 pb-8">
            {status === 'success' && (
              <div className="mb-6 p-4 bg-green-100 rounded-2xl text-center">
                <p className="text-green-800 font-semibold">Sent successfully! ✨</p>
              </div>
            )}

            {urlError && (
              <div className="mb-6 p-4 bg-red-100 rounded-2xl text-center">
                <p className="text-red-800 font-semibold">Error: {urlError}</p>
              </div>
            )}

            <ConfessionForm
              sendConfession={sendConfession}
              profileId={profileId}
              slug={slug}
              status={status}
            />

            {/* Get your own link - with shake on hover */}
            <div className="mt-6 text-center">
              <Link
                href="/sign-up"
                className="inline-block px-8 py-4 bg-white text-purple-700 font-bold text-lg rounded-full border-4 border-purple-600 shadow-lg hover:animate-shake transition-all"
              >
                Get your own messages!
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
