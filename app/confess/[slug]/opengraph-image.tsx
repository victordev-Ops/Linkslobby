// app/confess/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const alt = 'Send an anonymous message'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Ensure this runs properly on Vercel Edge
export const runtime = 'edge'

export default async function Image({ params }: { params: Promise<{ slug?: string }> }) {
  try {
    const { slug: rawSlug } = await params
    const slug = rawSlug?.trim().toLowerCase() || 'someone'

    let displayName = slug
    let isPro = false

    // We use a basic client here to avoid cookie/session crashes from SSR clients
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('username, is_pro')
          .eq('slug', slug)
          .single()

        if (!error && profile) {
          displayName = profile.username ?? slug
          isPro = profile.is_pro ?? false
        }
      }
    } catch (dbError) {
      console.error('OG Image Supabase Error:', dbError)
      // We do not throw here. If the DB fails, it simply falls back to the slug.
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
              Send an anonymous message to
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ color: '#ffffff', fontSize: 72, fontWeight: 'bold', letterSpacing: '-0.02em' }}>
                @{displayName}
              </div>
              
              {isPro && (
                <div style={{ display: 'flex', marginLeft: '8px' }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="#fbbf24" 
                    width="56"
                    height="56"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>

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
  } catch (e) {
    console.error('Fatal OG Image Error:', e)
    return new Response('Failed to generate image', { status: 500 })
  }
              }
              
