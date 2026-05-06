// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

// Create a variable to hold the singleton instance
let client: ReturnType<typeof createBrowserClient> | undefined

export const createClient = () => {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        sameSite: 'lax',
        path: '/',
      },
    }
  )
  
  return client
}
