'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export type AuthResponse = {
  success: boolean
  message: string
}

export async function signUp(email: string, next?: string): Promise<AuthResponse & { alreadyExists?: boolean }> {
  const supabase = await createSupabaseServerClient()

  // 1. Dynamic Origin Resolution
  // Prefers VERCEL_URL or custom env, falls back to localhost
  const origin = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const cleanOrigin = origin.replace(/\/$/, '')

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (existingUser) {
    return {
      success: false,
      message: 'Account already exists. Redirecting to login...',
      alreadyExists: true
    }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${cleanOrigin}/auth/confirm${next ? `?next=${encodeURIComponent(next)}` : ''}`,
    },
  })

  if (error) {
    console.error('Supabase OTP error:', error)
    return { success: false, message: error.message }
  }

  return { success: true, message: 'Magic link sent! Check your email.' }
}

export async function deleteAccount(): Promise<AuthResponse> {
  const supabase = await createSupabaseServerClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: 'Not authenticated' }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (serviceRoleKey && supabaseUrl) {
      // Use admin API to hard-delete the auth user (cascades to profile via FK)
      const { createClient: createAdminClient } = await import('@supabase/supabase-js')
      const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      const { error } = await adminClient.auth.admin.deleteUser(user.id)
      if (error) throw error
    } else {
      // Fallback: anonymize the profile (no service role key available)
      await supabase.from('profiles').update({
        username: `deleted_${user.id.slice(0, 8)}`,
        email: null,
        push_subscription: null,
        restricted_words: [],
      }).eq('id', user.id)
      await supabase.auth.signOut()
    }

    return { success: true, message: 'Account deleted successfully.' }
  } catch (error) {
    console.error('Delete Account Error:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to delete account' }
  }
}
