// app/confess/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const alt = 'Send an anonymous message'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Cache the generated image for an hour so we're not hitting the DB
// on every single crawler/bot request.
export const revalidate = 3600

// IMPORTANT: this route is hit by social-media crawlers (Twitter/X, Slack,
// Facebook, iMessage, Discord) with NO cookies attached. The old version used
// createSupabaseServerClient(), which reads/writes auth cookies via
// next/headers — that either throws in this context or silently fails RLS
// checks for unauthenticated requests, and the whole image generation
// blows up with no fallback. We use a plain anon-key client instead, since
// we're only reading public profile fields.
//
// NOTE: double check these env var names match what lib/supabase/server.ts
// actually uses in this project — if they're wrong, createClient() would
// normally throw at import time and 500 the whole route, which is why
// client creation is inside the try/catch below rather than at module scope.

export default async function Image({ params }: { params: Promise<{ slug?: string }> }) {
  const { slug: rawSlug } = await params
  const slug = rawSlug?.trim().toLowerCase()

  // Default values if lookup fails for any reason — the image should
  // ALWAYS render something rather than erroring out and showing no
  // preview at all.
  let displayName = slug ?? 'someone'
  let isPro = false

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase env vars for opengraph-image')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, is_pro')
      .eq('slug', slug)
      .single()

    if (!error && profile) {
      displayName = profile.username ?? slug ?? 'someone'
      isPro = profile.is_pro ?? false
    }
  } catch (err) {
    // Swallow the error — a wrong/generic name is far better than no
    // image at all. Log it so it's still visible in server logs.
    console.error('opengraph-image: profile lookup failed', err)
  }

  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: '#9333ea', // bg-purple-600
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: '40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '60px 80px',
            borderRadius: '24px',
          }}
        >
          <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 42, marginBottom: 20 }}>
            Send an anonymous confession to
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', color: '#ffffff', fontSize: 72, fontWeight: 'bold', letterSpacing: '-0.02em' }}>
              @{displayName}
            </div>

            {isPro && (
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#fbbf24', // amber-400
                  color: '#000000',
                  fontSize: 24,
                  fontWeight: 'bold',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  textTransform: 'uppercase',
                  marginLeft: '12px',
                }}
              >
                PRO
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 28,
            marginTop: 60,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: '500',
          }}
        >
          Powered by Say App
        </div>
      </div>
    ),
    { ...size }
  )
}
