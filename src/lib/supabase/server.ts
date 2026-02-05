// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Make this function async
export async function createSupabaseServerClient() {
  // 1️⃣ You MUST await cookies() in Next.js 15/16
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // Expected in Server Components where cookies are read-only
            // Only log in development for debugging session issues
            if (process.env.NODE_ENV === 'development') {
              console.debug('[Supabase] Cookie setAll called from read-only context')
            }
          }
        },
      },
    }
  )
}
