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
  const origin = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const cleanOrigin = origin.replace(/\/$/, '')

  // Security: Do NOT check if the user exists first — that leaks account existence.
  // Supabase's signInWithOtp handles both new and existing users seamlessly.
  // The magic link works for sign-up AND sign-in.

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
      const { createClient: createAdminClient } = await import('@supabase/supabase-js')
      const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      // Delete the profile row first (will trigger cascades across the database)
      const { error: profileError } = await adminClient.from('profiles').delete().eq('id', user.id)
      if (profileError) {
        console.error("Warning: Profile manual delete failed (might be handled by auth cascade):", profileError)
      }

      // Finally delete the auth user
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

    // Always ensure the active session is destroyed in the browser
    await supabase.auth.signOut()

    return { success: true, message: 'Account deleted successfully.' }
  } catch (error) {
    console.error('Delete Account Error:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to delete account' }
  }
}
