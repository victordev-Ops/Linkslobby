'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export type AuthResponse = {
  success: boolean
  message: string
}

export async function signUp(email: string): Promise<AuthResponse> {
  const supabase = await createSupabaseServerClient()
  
  // 1. Dynamic Origin Resolution
  // Prefers VERCEL_URL or custom env, falls back to localhost
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 
                 (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  
  const cleanOrigin = origin.replace(/\/$/, '')

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${cleanOrigin}/auth/confirm`,
    },
  })

  if (error) {
    console.error('Supabase OTP error:', error)
    return { success: false, message: error.message }
  }

  return { success: true, message: 'Magic link sent! Check your email.' }
}
