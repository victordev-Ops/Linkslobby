'use server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function signUp(email: string) {
  const supabase = await createSupabaseServerClient()
  // Use env var if available, otherwise fall back to production URL
  let siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') // remove trailing slash

  if (!siteUrl) {
    console.warn('NEXT_PUBLIC_SITE_URL not set – falling back to production URL')
    siteUrl = 'https://sayappz.netlify.app'
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  })

  if (error) {
    console.error('Supabase OTP error:', error)
    throw new Error(error.message || 'Failed to send magic link')
  }
}
