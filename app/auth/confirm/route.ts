//app/auth/confirm/route.ts
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
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      // 2. Redirect to destination (usually /dashboard).
      // We rely on app/dashboard/layout.tsx to detect if the user
      // has a profile/username. If not, the layout will redirect 
      // them to /auth/setup automatically.
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Fallback for expired or invalid tokens
  return NextResponse.redirect(new URL('/login?error=link-expired', request.url))
}
