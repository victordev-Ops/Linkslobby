import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              request.cookies.set(name, value)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error && data?.user) {
      // Create response to modify cookies and redirect
      const response = NextResponse.redirect(new URL(next, request.url))
      
      // IMPORTANT: Copy the cookies from the request (where supabase set them) to the response
      // This ensures the session sticks
      const { cookies } = await import('next/headers')
      // Note: In a standard route handler with @supabase/ssr, usually we let middleware handle the
      // session refresh, but manual copying here guarantees safety.
      // However, simpler pattern for Route Handlers with ssr is just returning the response
      // where we manually invoked setAll inside the createServerClient above? 
      // Actually, since we passed a dummy setAll above to request.cookies, we need to manually sync.
      
      // PROPER PATTERN for Route Handlers:
      const cookieStore = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() { return request.cookies.getAll() },
              setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => 
                  response.cookies.set(name, value, options)
                )
              }
            }
          }
      )
      // Re-verify to set cookies on the RESPONSE object
      await cookieStore.auth.verifyOtp({ type, token_hash })

      // Check Profile
      const { data: profile } = await cookieStore
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!profile) {
        return NextResponse.redirect(new URL('/auth/setup', request.url))
      }

      return response
    }
  }

  // Error handling: Redirect to login with error code
  return NextResponse.redirect(new URL('/login?error=auth_code_error', request.url))
        }
                
