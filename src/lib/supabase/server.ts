// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Correct pattern for Next.js 16 Server Components
export function createSupabaseServerClient() {
  // 1️⃣ DO NOT await cookies() here
  const cookieStore = cookies() // returns ReadonlyRequestCookies

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 2️⃣ Use cookieStore methods directly
        getAll: () => cookieStore.getAll(), 
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
