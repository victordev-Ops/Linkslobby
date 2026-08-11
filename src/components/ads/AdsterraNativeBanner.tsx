'use client'

import { useEffect, useRef } from 'react'

/**
 * Adsterra "Native Banner" ad unit.
 *
 * Renders the exact <script> + <div id="container-<key>"> pair Adsterra
 * gives you in the dashboard, injected via a ref so it re-runs correctly
 * across client-side navigations (Next.js won't do a full page load, so a
 * plain static <script> tag would only ever fire once for the whole app).
 *
 * --- Reusing the same adKey in more than one spot on one page ---
 * Adsterra's invoke.js finds its target by the literal id `container-<key>`.
 * Two instances of this component with the *same* adKey means two DOM nodes
 * sharing one id — `getElementById` only ever returns the first, so only
 * the first slot actually fills with an ad; the rest stay visually blank
 * (while still each firing a request). Adsterra's own placement guidance
 * also recommends against stacking more than ~2 native banner blocks on a
 * single page (https://adsterra.com/blog/turn-a-profit-with-native-banners/).
 *
 * To get real, independent ad slots in multiple spots on the same page,
 * create a separate Native Banner ad unit per spot in the Adsterra
 * dashboard and pass each one's key in via `adKey`.
 */

const DEFAULT_AD_KEY = '2fe52b5d8001239d45c7179b4fbc5cfc'
const AD_HOST = 'https://pl30794763.effectivecpmnetwork.com'

interface AdsterraNativeBannerProps {
  /** Zone key from the Adsterra dashboard. Defaults to your only current key. */
  adKey?: string
  className?: string
  /** Small "Advertisement" label above the slot, for clarity/compliance. */
  showLabel?: boolean
}

export default function AdsterraNativeBanner({
  adKey = DEFAULT_AD_KEY,
  className = '',
  showLabel = true,
}: AdsterraNativeBannerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const mountedForKey = useRef<string | null>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    // Skip re-injecting if we already mounted this exact key (guards
    // against React 18 StrictMode's dev-only double-invoke of effects).
    if (mountedForKey.current === adKey) return
    mountedForKey.current = adKey

    wrapper.innerHTML = ''

    const container = document.createElement('div')
    container.id = `container-${adKey}`
    wrapper.appendChild(container)

    const script = document.createElement('script')
    script.async = true
    script.setAttribute('data-cfasync', 'false')
    script.src = `${AD_HOST}/${adKey}/invoke.js`
    wrapper.appendChild(script)

    return () => {
      mountedForKey.current = null
      wrapper.innerHTML = ''
    }
  }, [adKey])

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      {showLabel && (
        <span className="text-[9px] uppercase tracking-widest text-gray-300 dark:text-gray-600 font-bold mb-1 select-none">
          Advertisement
        </span>
      )}
      <div ref={wrapperRef} className="w-full flex justify-center min-h-[1px]" />
    </div>
  )
}
