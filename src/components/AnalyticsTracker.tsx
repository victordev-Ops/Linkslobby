"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

// Isolated in its own component (rather than living inline in ClientLayout)
// specifically so useSearchParams() can be wrapped in a narrow <Suspense>
// boundary. useSearchParams() bails out of static rendering for whatever
// tree it's called in — during `next build`, that bailout propagated all
// the way up to statically-generated routes with no params at all (e.g.
// /404, /_not-found), which have no Suspense boundary above them, and
// build failed with "useSearchParams() should be wrapped in a suspense
// boundary". Scoping the hook to this leaf component means only this
// component bails to client-side rendering — the Suspense fallback={null}
// wrapper around it in ClientLayout absorbs that bailout instead of it
// propagating to the page itself.
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // GA4 pageview tracking on client-side route changes.
  // The gtag('config', ...) call in RootLayout's <Script> only fires a
  // pageview for the initial document load. Every navigation after that
  // is a client-side route change that GA never sees unless we send it
  // an explicit page_view event ourselves — this effect is that event.
  useEffect(() => {
    if (typeof window.gtag !== "function") return;

    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;

    window.gtag("event", "page_view", {
      page_path: url,
    });
  }, [pathname, searchParams]);

  return null;
}
