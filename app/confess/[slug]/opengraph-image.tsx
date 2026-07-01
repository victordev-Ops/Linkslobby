// app/confess/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const alt = 'Send an anonymous message'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Cache the generated image for an hour so we're not hitting the DB
// on every single crawler/bot request.
export const revalidate = 3600

// Loads a Google Font weight, subset to only the characters we actually
// render (keeps the request small and fast). Never throws — callers get
// `null` back on any failure and fall back to the system font instead of
// crashing the whole image.
async function loadGoogleFont(family: string, weight: number, text: string) {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family
    )}:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (await fetch(cssUrl)).text()
    const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype)'\)/)
    if (!match) return null
    const res = await fetch(match[1])
    if (res.status !== 200) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

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
    console.error('opengraph-image: profile lookup failed', err)
  }

  // Copy — personalised, curiosity-driven, and specific to the confession
  // format rather than generic "send a message" boilerplate.
  const eyebrow = '🔒  ANONYMOUS CONFESSIONS'
  const subheadline = 'wants to know what you really think 👀'
  const bubblePlaceholder = "Say something they'll never see coming..."
  const footer = '🤫  100% Anonymous  ·  Say'

  const fontText = `${eyebrow}${displayName}${subheadline}${bubblePlaceholder}${footer}PRO`
  const [poppinsBold, poppinsExtraBold] = await Promise.all([
    loadGoogleFont('Poppins', 600, fontText),
    loadGoogleFont('Poppins', 800, fontText),
  ])

  const fonts = []
  if (poppinsExtraBold) fonts.push({ name: 'Poppins', data: poppinsExtraBold, weight: 800 as const, style: 'normal' as const })
  if (poppinsBold) fonts.push({ name: 'Poppins', data: poppinsBold, weight: 600 as const, style: 'normal' as const })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px',
          fontFamily: fonts.length ? 'Poppins' : 'sans-serif',
          background: 'linear-gradient(135deg, #2E1065 0%, #7C3AED 48%, #EC4899 100%)',
          position: 'relative',
        }}
      >
        {/* Soft glow accents for depth, so the gradient doesn't read flat */}
        <div
          style={{
            position: 'absolute',
            top: -140,
            right: -140,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: 'rgba(251, 191, 36, 0.18)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -160,
            left: -120,
            width: 460,
            height: 460,
            borderRadius: 9999,
            background: 'rgba(255, 255, 255, 0.08)',
            display: 'flex',
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.08em',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '10px 24px',
            borderRadius: 9999,
            marginBottom: 36,
          }}
        >
          {eyebrow}
        </div>

        {/* Name + optional PRO badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              color: '#ffffff',
              fontSize: 86,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              textShadow: '0 4px 24px rgba(0,0,0,0.25)',
            }}
          >
            {displayName}
          </div>

          {isPro && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#3B2400',
                fontSize: 24,
                fontWeight: 800,
                padding: '8px 20px',
                borderRadius: 9999,
                background: 'linear-gradient(135deg, #FDE68A 0%, #FBBF24 100%)',
              }}
            >
              PRO
            </div>
          )}
        </div>

        {/* Subheadline */}
        <div
          style={{
            display: 'flex',
            color: 'rgba(255, 255, 255, 0.82)',
            fontSize: 34,
            fontWeight: 600,
            marginBottom: 56,
          }}
        >
          {subheadline}
        </div>

        {/* Fake input bubble — the signature element. Makes the preview
            itself look like the thing you're about to tap into. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: 880,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 9999,
            padding: '14px 14px 14px 36px',
            boxShadow: '0 20px 60px rgba(46, 16, 101, 0.35)',
          }}
        >
          <div
            style={{
              display: 'flex',
              color: 'rgba(46, 16, 101, 0.45)',
              fontSize: 28,
              fontWeight: 600,
            }}
          >
            {bubblePlaceholder}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 60,
              borderRadius: 9999,
              background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: '11px solid transparent',
                borderBottom: '11px solid transparent',
                borderLeft: '16px solid #ffffff',
                marginLeft: 6,
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.04em',
            marginTop: 44,
          }}
        >
          {footer}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  )
}
