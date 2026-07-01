// app/dykm/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

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
          backgroundColor: '#DBEAFE', // bg-blue-100
          padding: '40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: 'rgba(59, 130, 246, 0.2)', // dark:bg-blue-500/20
            padding: '60px',
            borderRadius: '24px',
            border: '2px solid rgba(96, 165, 250, 0.5)',
          }}
        >
          <div style={{ color: '#60A5FA', fontSize: 40, marginBottom: 20, fontWeight: 600 }}>
            Do You Know Me?
          </div>
          <h1
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: '#3B82F6', // dark:text-blue-400
              textAlign: 'center',
              margin: 0,
            }}
          >
            Answer this if you know {displayName}...
          </h1>
        </div>
      </div>
    ),
    { ...size }
  )
}
