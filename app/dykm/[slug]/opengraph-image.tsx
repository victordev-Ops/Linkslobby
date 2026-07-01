// app/dykm/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const alt = 'Do You Know Me? — Take the quiz'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: { slug: string } }) {
  const { slug } = await params
  const displayName = slug.charAt(0).toUpperCase() + slug.slice(1)

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
          background: 'linear-gradient(135deg, #BFDBFE 0%, #60A5FA 30%, #3B82F6 70%, #1E3A8A 100%)',
          position: 'relative',
          padding: '0 80px', // Added horizontal padding to prevent edge clipping
        }}
      >
        {/* Motif */}
        <div
          style={{
            position: 'absolute',
            top: 64,
            left: 72,
            display: 'flex',
            width: 88,
            height: 88,
            borderRadius: 9999,
            background: 'rgba(219, 234, 254, 0.25)',
            border: '2px solid rgba(219, 234, 254, 0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 44,
            fontWeight: 800,
            color: '#DBEAFE',
          }}
        >
          ?
        </div>

        {/* Wordmark with refined spacing */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: '#ffffff',
            fontSize: 100, // Slightly reduced to ensure better word distribution
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.1, // Increased line-height for readability
            textShadow: '0 8px 30px rgba(0,0,0,0.35)',
            textAlign: 'center',
          }}
        >
          <span>Answer this if you</span>
          <span style={{ marginTop: '16px' }}>know {displayName}...</span>
        </div>

        {/* Accent divider */}
        <div
          style={{
            display: 'flex',
            width: 84,
            height: 8,
            borderRadius: 9999,
            background: 'linear-gradient(90deg, #DBEAFE 0%, #BFDBFE 100%)',
            marginTop: 48,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
