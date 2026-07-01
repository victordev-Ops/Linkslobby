// app/hot-seat/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const alt = 'Hot Seat Session — Join the rapid fire'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: { slug: string } }) {
  const { slug } = await params
  // Assuming the session identifier or host context can be represented here
  const sessionLabel = "Hot Seat"

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
          // Amber gradient for high-energy, rapid-fire intensity
          background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 30%, #D97706 70%, #78350F 100%)',
          position: 'relative',
          padding: '0 80px',
        }}
      >
        {/* Spotlight Accent */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: -100,
            width: 300,
            height: 300,
            borderRadius: 9999,
            background: 'rgba(251, 191, 36, 0.4)',
            filter: 'blur(60px)',
          }}
        />

        {/* Label Motif */}
        <div
          style={{
            display: 'flex',
            padding: '12px 24px',
            borderRadius: 9999,
            background: 'rgba(255, 255, 255, 0.2)',
            border: '2px solid rgba(255, 255, 255, 0.4)',
            color: '#FFFBEB',
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 32,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {sessionLabel} Session
        </div>

        {/* Main Call to Action */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: '#ffffff',
            fontSize: 90,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            textShadow: '0 8px 30px rgba(0,0,0,0.3)',
            textAlign: 'center',
          }}
        >
          <span>Ready for the</span>
          <span style={{ color: '#FEF3C7' }}>Rapid Fire?</span>
        </div>

        {/* Secondary Instruction */}
        <div
          style={{
            marginTop: 32,
            fontSize: 36,
            color: 'rgba(255, 255, 255, 0.9)',
            fontWeight: 500,
          }}
        >
          Jump in and ask your best questions!
        </div>
      </div>
    ),
    { ...size }
  )
}
