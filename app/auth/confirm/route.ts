import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient()

    // 1. Verify the OTP/Magic Link token
    const { data: { user }, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error && user) {
      // 2. Check if the profile already has a username
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      // 3. Logic: If no username, they are new/onboarding -> send to setup
      // If they have a username -> send to dashboard
      const redirectTo = (profile && profile.username) ? next : '/auth/setup'
      
      return NextResponse.redirect(new URL(redirectTo, request.url))
    }
  }

  // Fallback for expired or invalid tokens
  return NextResponse.redirect(new URL('/login?error=link-expired', request.url))
           }
          
