import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

// ← Make this async
export async function createSupabaseServerClient({
  revalidate,
  tags = [],
}: { revalidate?: number; tags?: string[] } = {}) {
  const cookieStore = await cookies()  // ← Await here

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
            // Ignore in read-only contexts (e.g. generateMetadata)
          }
        },
      },
      global: {
        fetch: fetchWithCache({ revalidate, tags: ['supabase', ...tags] }),
      },
    }
  )
                                                   }
