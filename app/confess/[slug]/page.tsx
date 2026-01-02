// app/confess/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react' // We need client-side state for the counter

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug?: string }>
  searchParams: Promise<{ status?: string; error?: string }>
}

// Client component for the form with character counter
function ConfessionForm({ username, profileId, slug, status }: { username: string; profileId: string; slug: string; status?: string }) {
  const [characterCount, setCharacterCount] = useState(0)

  return (
    <form action={sendConfession.bind(null, profileId, slug)} className="space-y-8">
      <div>
        <label htmlFor="message" className="block text-lg font-semibold text-purple-900 mb-4">
          Your confession (100% anonymous)
        </label>
        <textarea
          id="message"
          name="message"
          rows={8}
          placeholder="Say anything... they'll never know it's you ❤️"
          className="w-full px-6 py-5 border-2 border-purple-300 rounded-3xl focus:ring-4 focus:ring-purple-400 focus:border-purple-600 resize-none transition-all duration-300 shadow-inner text-gray-900 placeholder-gray-500"
          required
          minLength={1}
          maxLength={1000}
          defaultValue={status === 'success' ? '' : undefined}
          onChange={(e) => setCharacterCount(e.target.value.length)}
        />
        <div className="mt-3 flex justify-between items-center">
          <p className="text-sm text-purple-600 font-medium">
            Max 1000 characters
          </p>
          <p className={`text-sm font-bold transition-colors ${
            characterCount > 900 ? 'text-red-600' :
            characterCount > 700 ? 'text-orange-600' :
            'text-purple-600'
          }`}>
            {characterCount}/1000
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={characterCount === 0}
        className="relative w-full py-6 overflow-hidden bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-xl rounded-3xl hover:from-purple-700 hover:to-violet-700 transform hover:scale-105 hover:shadow-2xl transition-all duration-500 group disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
      >
        <span className="relative z-10">Send Anonymously</span>
        <span className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-150 transition-transform duration-700 rounded-full"></span>
      </button>
    </form>
  )
}

// Server Action (now accepts parameters)
async function sendConfession(profileId: string, slug: string, formData: FormData) {
  'use server'

  const supabaseAction = await createSupabaseServerClient()

  const message = (formData.get('message') as string)?.trim()

  if (!message || message.length < 1 || message.length > 1000) {
    redirect(`/confess/${slug}?error=Message must be 1–1000 characters`)
  }

  const { error: insertError } = await supabaseAction
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-violet-50 to-purple-100 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="animate-fade-in-up bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden border border-purple-200">
          <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-violet-700 p-12 text-white text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight animate-fade-in">
              Send an Anonymous Confession
            </h1>
            <p className="text-3xl md:text-4xl mt-6 font-semibold animate-fade-in-delay">
              to @{username}
            </p>
          </div>

          <div className="p-8 md:p-12">
            {status === 'success' && (
              <div className="mb-10 p-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-3xl text-center animate-slide-in-up">
                <p className="text-2xl text-green-800 font-bold">Confession sent successfully! ✨</p>
                <p className="text-lg text-green-700 mt-3">@{username} will see it soon.</p>
              </div>
            )}

            {urlError && (
              <div className="mb-10 p-8 bg-gradient-to-r from-red-50 to-rose-50 border border-red-300 rounded-3xl text-center animate-shake">
                <p className="text-xl text-red-800 font-bold">Error: {urlError}</p>
              </div>
            )}

            {/* Client-side form with character counter */}
            <ConfessionForm username={username} profileId={profileId} slug={slug} status={status} />

            <div className="mt-12 text-center">
              <p className="text-base text-purple-800 leading-relaxed">
                This message is <span className="font-bold text-purple-900">completely anonymous</span>.
                <br />
                The recipient will never know who sent it.
              </p>

              <p className="mt-10 text-purple-700">
                Want your own confession link?{' '}
                <Link href="/" className="font-bold underline hover:text-purple-900 transition-colors">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
                }
