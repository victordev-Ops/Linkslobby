// app/tod/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const alt = 'Truth or Dare — Hop In. Let’s Play.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Static branding image — no per-user data needed, so it can be cached
// aggressively and has no external calls that could fail.
export const revalidate = 86400

// Loads a Google Font weight, subset to only the characters we render.
// Never throws — returns null on any failure so the image still renders
// with the system font instead of crashing.
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

export default async function Image() {
  const wordmark = 'Truth or Dare'
  const tagline = 'Hop In. Let’s Play.'

  const [poppinsExtraBold, poppinsSemiBold] = await Promise.all([
    loadGoogleFont('Poppins', 800, wordmark),
    loadGoogleFont('Poppins', 600, tagline),
  ])

  const fonts = []
  if (poppinsExtraBold) fonts.push({ name: 'Poppins', data: poppinsExtraBold, weight: 800 as const, style: 'normal' as const })
  if (poppinsSemiBold) fonts.push({ name: 'Poppins', data: poppinsSemiBold, weight: 600 as const, style: 'normal' as const })

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
          fontFamily: fonts.length ? 'Poppins' : 'sans-serif',
          // Pepper red linear gradient matching the requested ascent
          background: 'linear-gradient(135deg, #F87171 0%, #EF4444 30%, #DC2626 70%, #7F1D1D 100%)',
          position: 'relative',
        }}
      >
        {/* Soft glow accents */}
        <div
          style={{
            position: 'absolute',
            top: -140,
            right: -140,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: 'rgba(239, 68, 68, 0.45)',
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

        {/* Motif icon area */}
        <div
          style={{
            position: 'absolute',
            top: 64,
            left: 72,
            display: 'flex',
            width: 88,
            height: 88,
            borderRadius: 9999,
            background: 'rgba(254, 202, 202, 0.25)',
            border: '2px solid rgba(254, 202, 202, 0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 44,
            fontWeight: 800,
            color: '#FEE2E2',
          }}
        >
          !
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: 'flex',
            color: '#ffffff',
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            textShadow: '0 8px 30px rgba(0,0,0,0.35)',
          }}
        >
          {wordmark}
        </div>

        {/* Accent divider */}
        <div
          style={{
            display: 'flex',
            width: 84,
            height: 8,
            borderRadius: 9999,
            background: 'linear-gradient(90deg, #FEE2E2 0%, #FECACA 100%)',
            marginTop: 28,
            marginBottom: 28,
          }}
        />

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            color: 'rgba(255, 255, 255, 0.95)',
            fontSize: 36,
            fontWeight: 600,
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  )
        }
          
