// app/confess/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { createSupabaseServerClient } from '@/lib/supabase/server' //[span_3](start_span)[span_3](end_span)

export const alt = 'Send an anonymous message'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Ensure we handle the Promise params correctly for Next.js 15+[span_4](start_span)[span_4](end_span)
export default async function Image({ params }: { params: Promise<{ slug?: string }> }) {
  const { slug: rawSlug } = await params //[span_5](start_span)[span_5](end_span)
  const slug = rawSlug?.trim().toLowerCase() //[span_6](start_span)[span_6](end_span)

  // Fetch the dynamic user data to match the page's UX[span_7](start_span)[span_7](end_span)
  const supabase = await createSupabaseServerClient() //[span_8](start_span)[span_8](end_span)
  const { data: profile } = await supabase
    .from('profiles') //[span_9](start_span)[span_9](end_span)
    .select('username, is_pro') //[span_10](start_span)[span_10](end_span)
    .eq('slug', slug) //[span_11](start_span)[span_11](end_span)
    .single() //[span_12](start_span)[span_12](end_span)

  // Fallback to slug if username is null[span_13](start_span)[span_13](end_span)
  const displayName = profile?.username ?? slug //[span_14](start_span)[span_14](end_span)
  const isPro = profile?.is_pro ?? false //[span_15](start_span)[span_15](end_span)

  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: '#9333ea', // Hex code for bg-purple-600[span_16](start_span)[span_16](end_span)
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
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          backgroundColor: 'rgba(255, 255, 255, 0.1)', 
          padding: '60px 80px', 
          borderRadius: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 42, marginBottom: 20 }}>
            Send an anonymous confession to
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ color: '#ffffff', fontSize: 72, fontWeight: 'bold', letterSpacing: '-0.02em' }}>
              @{displayName}
            </div>
            
            {/* Dynamically render a PRO badge if the user is a pro account[span_17](start_span)[span_17](end_span) */}
            {isPro && (
              <div style={{
                backgroundColor: '#fbbf24', // Amber-400
                color: '#000000',
                fontSize: 24,
                fontWeight: 'bold',
                padding: '8px 16px',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                marginLeft: '12px'
              }}>
                PRO
              </div>
            )}
          </div>
        </div>

        {/* Footer matching your page's exact branding text[span_18](start_span)[span_18](end_span) */}
        <div style={{ 
          color: 'rgba(255, 255, 255, 0.6)', 
          fontSize: 28, 
          marginTop: 60, 
          textTransform: 'uppercase', 
          letterSpacing: '0.1em',
          fontWeight: '500'
        }}>
          Powered by Say App
        </div>
      </div>
    ),
    { ...size }
  )
}
