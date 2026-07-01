'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirects on the client, after mount.
 *
 * Unlike calling redirect() inside a Server Component (which aborts the
 * request with a 307 before the HTML — and its <head> metadata — is ever
 * sent), this lets the server return a full 200 response with the page's
 * OG tags intact. Real browsers get sent along right after hydration;
 * crawlers/bots that don't execute JS just see the static page and its
 * metadata, which is what we want for link previews.
 */
export default function ClientRedirect({ to }: { to: string }) {
  const router = useRouter()

  useEffect(() => {
    router.replace(to)
  }, [router, to])

  return null
}
