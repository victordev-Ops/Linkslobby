// app/rps/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const alt = 'Rock Paper Scissors — Join the room'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const roomCode = 'B29CED' // This should ideally be extracted from searchParams

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
          background: 'linear-gradient(135deg, #DCFCE7 0%, #22C55E 30%, #16A34A 70%, #064E3B 100%)',
          position: 'relative',
          padding: '0 80px',
        }}
      >
        {/* Emojis to signify game type */}
        <div style={{ display: 'flex', fontSize: 120, marginBottom: 20 }}>
          👊✋✌️
        </div>

        {/* Room Label */}
        <div
          style={{
            display: 'flex',
            padding: '12px 24px',
            borderRadius: 9999,
            background: 'rgba(255, 255, 255, 0.2)',
            border: '2px solid rgba(255, 255, 255, 0.4)',
            color: '#F0FDF4',
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 24,
            textTransform: 'uppercase',
          }}
        >
          RPS Room
        </div>

        {/* Main Invite Text */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: '#ffffff',
            fontSize: 80,
            fontWeight: 800,
            textAlign: 'center',
            textShadow: '0 8px 30px rgba(0,0,0,0.3)',
          }}
        >
          <span>Challenge me to</span>
          <span style={{ color: '#DCFCE7' }}>Rock Paper Scissors!</span>
        </div>

        {/* Room Code Display */}
        <div
          style={{
            marginTop: 40,
            padding: '16px 32px',
            borderRadius: 16,
            background: 'rgba(0, 0, 0, 0.2)',
            color: '#ffffff',
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: '0.1em',
            border: '2px dashed rgba(255, 255, 255, 0.3)',
          }}
        >
          Code: {roomCode}
        </div>
      </div>
    ),
    { ...size }
  )
}
