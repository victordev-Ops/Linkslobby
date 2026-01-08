import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const cookieStore = cookies()
    
    // Create a Supabase client configured to set cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // 1. Exchange the token for a session
    const { data: { user }, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error && user) {
      // 2. Check the profiles table for a username
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      // 3. Conditional Redirect
      // If profile exists and has a username, go to dashboard.
      // Otherwise, go to setup.
      if (profile && profile.username) {
         return NextResponse.redirect(new URL('/dashboard', request.url))
      } else {
         return NextResponse.redirect(new URL('/auth/setup', request.url))
      }
    }
  }

  // If verification fails, redirect to an error page
  return NextResponse.redirect(new URL('/auth/auth-code-error', request.url))
    }
