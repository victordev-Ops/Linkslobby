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
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:py-12">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-10 text-center text-white">
            <h1 className="text-2xl sm:text-3xl font-bold">Send Anonymous Confession</h1>
            <p className="mt-3 text-xl sm:text-2xl font-medium">to @{username}</p>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8">
            {/* Success Message */}
            {status === 'success' && (
              <div className="mb-8 p-5 bg-green-50 border border-green-200 rounded-xl text-center">
                <p className="text-green-800 font-semibold text-lg">Sent successfully! ✨</p>
                <p className="text-green-700 mt-1">@{username} will see it soon.</p>
              </div>
            )}

            {/* Error Message */}
            {urlError && (
              <div className="mb-8 p-5 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-red-800 font-semibold">Error: {urlError}</p>
              </div>
            )}

            {/* Form + CTA Buttons */}
            <ConfessionForm
              sendConfession={sendConfession}
              profileId={profileId}
              slug={slug}
              status={status}
              username={username}
            />

            {/* Anonymity Note */}
            <p className="mt-10 text-center text-sm text-gray-600">
              This message is <span className="font-semibold text-gray-800">100% anonymous</span>.<br />
              They will never know it was you.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
    }
