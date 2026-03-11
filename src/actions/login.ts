'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AuthResponse = {
    success: boolean
    message: string
}

export async function signIn(email: string, next?: string): Promise<AuthResponse> {
    const supabase = await createSupabaseServerClient()

    // Dynamic Origin Resolution - matches signup pattern
    const origin = process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const cleanOrigin = origin.replace(/\/$/, '')

    const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
            shouldCreateUser: false, // Login should never create new auth users — that's signup's job
            emailRedirectTo: `${cleanOrigin}/auth/confirm${next ? `?next=${encodeURIComponent(next)}` : ''}`,
        },
    })

    if (error) {
        console.error('Supabase OTP error:', error)
        return { success: false, message: error.message }
    }

    return { success: true, message: 'Magic link sent! Check your email.' }
}
