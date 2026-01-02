// app/auth/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  // 1. Initial redirect target if things go wrong
  const errorRedirect = NextResponse.redirect(`${origin}/login?error=auth_failed`)

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`)
  }

  // 2. Create a response object for the SUCCESS case
  // We don't know the final destination yet, so we'll update this later
  let response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            // This is the crucial part: setting cookies on our response object
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // 3. This call triggers setAll() above, attaching session cookies to 'response'
  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  })

  if (error || !data.user) {
    return errorRedirect 
  }

  // 4. Check for profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) {
    // 5. IMPORTANT: Instead of creating a NEW response, 
    // we change the URL of the response that already HAS the cookies.
    const setupUrl = new URL('/auth/setup', origin)
    return NextResponse.redirect(setupUrl, {
      headers: response.headers, // Carry over the set-cookie headers
    })
  }

  return response
}
  
