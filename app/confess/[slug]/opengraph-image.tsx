// app/confess/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Send an anonymous message'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug?: string }> }) {
  const { slug: rawSlug } = await params
  const slug = rawSlug?.trim().toLowerCase() || 'someone'

  let displayName = slug
  let isPro = false

  try {
    // 1. Use pure native fetch instead of the Supabase client. 
    // This is 100x lighter and prevents Edge runtime silent crashes.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?slug=eq.${slug}&select=username,is_pro`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      )
      
      if (res.ok) {
        const data = await res.json()
        if (data && data.length > 0) {
          displayName = data[0].username ?? slug
          isPro = data[0].is_pro ?? false
        }
      }
    }
  } catch (e) {
    console.error('OG Fetch error:', e)
  }

  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: '#9333ea',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: 40, // Satori prefers pure numbers over '40px'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            // 2. Satori hates shorthand padding. Break it out explicitly.
            paddingTop: 60,
            paddingBottom: 60,
            paddingLeft: 80,
            paddingRight: 80,
            borderRadius: 24,
            // Removed box-shadow as it frequently causes silent Satori rendering failures
          }}
        >
          <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 42, marginBottom: 20 }}>
            Send an anonymous message to
          </div>

          {/* 3. Removed 'gap' (unreliable in Satori), used explicit margins instead */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ color: '#ffffff', fontSize: 72, fontWeight: 'bold' }}>
              @{displayName}
            </div>

            {isPro && (
              <div style={{ display: 'flex', marginLeft: 16 }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="#fbbf24">
                  <path d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 28,
            marginTop: 60,
            textTransform: 'uppercase',
            fontWeight: 'bold',
          }}
        >
          Powered by Say App
        </div>
      </div>
    ),
    { ...size }
  )
}
