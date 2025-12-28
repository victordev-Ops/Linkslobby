// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'  // Assuming you have types generated

// Custom fetch that injects Next.js cache options
const fetchWithCache = ({ revalidate, tags }: { revalidate?: number; tags?: string[] } = {}) =>
  (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, {
      ...init,
      next: {
        revalidate: revalidate ?? 3600, // Default: cache for 1 hour
        tags: tags ?? ['supabase'],     // Default tag
      },
    })

export function createSupabaseServerClient({
  revalidate,
  tags = [],
}: { revalidate?: number; tags?: string[] } = {}) {
  const cookieStore = cookies()

  return createServerClient<Database>(
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
          } catch {
            // Ignore in read-only contexts
          }
        },
      },
      global: {
        // Override fetch for all Supabase requests
        fetch: fetchWithCache({ revalidate, tags: ['supabase', ...tags] }),
      },
    }
  )
              }
