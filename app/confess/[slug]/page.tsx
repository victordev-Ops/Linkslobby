// app/confess/[slug]/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug?: string }>
  searchParams: Promise<{ status?: string; error?: string }>
}

export default async function ConfessPage({ params, searchParams }: PageProps) {
  // Await params and searchParams
  const { slug: rawSlug } = await params
  const { status, error: urlError } = await searchParams

  const slug = rawSlug?.trim().toLowerCase()

  // 🔎 Debug logs
  console.log('[ConfessPage] Incoming request:', {
    rawSlug,
    normalizedSlug: slug,
    status,
    urlError,
  })

  if (!slug) {
    console.warn('[ConfessPage] No slug provided, returning 404')
    notFound()
  }

  const supabase = createSupabaseServerClient()

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, slug')
    .eq('slug', slug)
    .single()

  console.log('[ConfessPage] Supabase profile query result:', {
    profile,
    profileError,
  })

  if (profileError || !profile) {
    console.error('[ConfessPage] Profile fetch error:', profileError)
    notFound()
  }

  const { id: profileId, username } = profile

  // Server Action
  async function sendConfession(formData: FormData) {
    'use server'

    const supabaseAction = createSupabaseServerClient()
    const message = (formData.get('message') as string)?.trim()

    console.log('[sendConfession] Attempting insert:', {
      slug,
      profileId,
      messageLength: message?.length,
    })

    if (!message || message.length < 1 || message.length > 1000) {
      console.warn('[sendConfession] Invalid message length')
      redirect(`/confess/${slug}?error=Message must be 1–1000 characters`)
    }

    const { error: insertError } = await supabaseAction
      .from('confessions')
      .insert({
        profile_id: profileId,
        message,
      })

    if (insertError) {
      console.error('[sendConfession] Insert failed:', insertError)
      redirect(`/confess/${slug}?error=Failed to send confession`)
    }

    console.log('[sendConfession] Insert success for profile:', profileId)
    redirect(`/confess/${slug}?status=success`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 py-12 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-10 text-white text-center">
          <h1 className="text-3xl md:text-4xl font-bold">Send an Anonymous Confession</h1>
          <p className="text-2xl md:text-3xl mt-4">to @{username}</p>
        </div>

        <div className="p-8">
          {status === 'success' && (
            <div className="mb-8 p-6 bg-green-50 border border-green-300 rounded-2xl text-center">
              <p className="text-green-800 font-bold text-lg">Confession sent successfully! ✨</p>
              <p className="text-green-700 mt-2">@{username} will see it soon.</p>
            </div>
          )}

          {urlError && (
            <div className="mb-8 p-6 bg-red-50 border border-red-300 rounded-2xl text-center">
              <p className="text-red-800 font-bold">Error: {urlError}</p>
            </div>
          )}

          <form action={sendConfession} className="space-y-6">
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-3">
                Your confession (100% anonymous)
              </label>
              <textarea
                id="message"
                name="message"
                rows={8}
                placeholder="Say anything... they'll never know it's you ❤️"
                className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 resize-none transition-shadow text-gray-900"
                required
                minLength={1}
                maxLength={1000}
                defaultValue={status === 'success' ? '' : undefined}
              />
              <p className="mt-2 text-xs text-gray-500 text-right">Max 1000 characters</p>
            </div>

            <button
              type="submit"
              className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-2xl hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all shadow-lg"
            >
              Send Anonymously
            </button>
          </form>

          <p className="mt-10 text-center text-sm text-gray-600 leading-relaxed">
            This message is <span className="font-semibold">completely anonymous</span>.
            <br />
            The recipient will never know who sent it.
          </p>
        </div>
      </div>
    </div>
  )
              }
