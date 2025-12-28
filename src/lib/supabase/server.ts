// src/lib/supabase/server.ts  (small improvement)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createSupabaseServerClient = () => {
  const cookieStore = cookies()  // No need for async/await in Next.js 15+

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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore in server-only contexts like route handlers
          }
        },
      },
    }
  )
}
