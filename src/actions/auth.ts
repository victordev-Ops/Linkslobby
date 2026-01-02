'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
// Ensure you have headers() available if your createSupabaseServerClient depends on it

export type AuthResponse = {
  success: boolean
  message: string
}

export async function signUp(email: string): Promise<AuthResponse> {
  const supabase = await createSupabaseServerClient()
  
  // UX: Fallback logic remains, but we clean the URL carefully
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://sayappz.netlify.app'
  const siteUrl = origin.replace(/\/$/, '')

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  })

  if (error) {
    console.error('Supabase OTP error:', error)
    // UX: Don't expose technical errors like "Database connection failed" to users
    // Instead return a friendly failure
    return { success: false, message: error.message }
  }

  return { success: true, message: 'Magic link sent! Check your email.' }
}
