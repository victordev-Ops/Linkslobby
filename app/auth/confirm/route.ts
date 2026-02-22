//app/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? ''

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient()

    // 1. Verify the OTP/Magic Link token
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error && data.user) {
      // 2. Check if profile exists and is complete
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, slug')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Profile check error:', profileError)
      }

      // Note: Profile creation happens in setupProfile action via upsert
      // Just redirect based on current state

      // 4. Redirect based on profile completion
      if (profile?.username && profile?.slug) {
        // Profile complete -> go to next or dashboard
        const redirectUrl = next ? new URL(next, request.url) : new URL('/dashboard', request.url)
        return NextResponse.redirect(redirectUrl)
      } else {
        // Profile incomplete -> go to setup
        const setupUrl = new URL('/auth/setup', request.url)
        if (next) setupUrl.searchParams.set('next', next)
        return NextResponse.redirect(setupUrl)
      }
    }
  }

  // Fallback for expired or invalid tokens
  return NextResponse.redirect(new URL('/login?error=link-expired', request.url))
}
