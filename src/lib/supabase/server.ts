import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
// ← Remove this line completely
// import type { Database } from '@/types/supabase'

// Custom fetch that injects Next.js cache options
const fetchWithCache = ({ revalidate, tags }: { revalidate?: number; tags?: string[] } = {}) =>
  (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, {
      ...init,
      next: {
        revalidate: revalidate ?? 3600,
        tags: tags ?? ['supabase'],
      },
    })

export function createSupabaseServerClient({
  revalidate,
  tags = [],
}: { revalidate?: number; tags?: string[] } = {}) {
  const cookieStore = cookies()

  // ← Remove <Database> here
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
          } catch {
            // Ignore in read-only contexts
          }
        },
      },
      global: {
        fetch: fetchWithCache({ revalidate, tags: ['supabase', ...tags] }),
      },
    }
  )
                              }
