'use client'

import { useEffect, useRef, useState } from 'react'

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
  /**
   * Cross-fades the slot in and out on a loop instead of leaving it
   * statically visible — shrinks how much visual space the ad occupies at
   * any given instant so a native banner reads as a passing element in the
   * feed rather than a long fixed block.
   *
   * Important: this only toggles CSS opacity/height on the already-mounted
   * slot. It never re-injects Adsterra's <script>, so it doesn't generate a
   * fresh ad request each cycle — repeatedly re-invoking the script on a
   * timer is what ad networks flag as refresh/impression abuse.
   *
   * Timing is randomized per cycle rather than fixed, and deliberately
   * asymmetric: the visible phase is drawn from a longer range than the
   * hidden phase. Ad viewability/RPM is roughly a function of dwell time,
   * so keeping it on-screen longer than it's off-screen protects earnings,
   * while randomization (vs. a metronomic fixed interval) reads as less
   * mechanical to the user.
   */
  cycle?: boolean
  /** Random visible-phase duration range in ms. Default [5000, 9000]. */
  visibleRangeMs?: [number, number]
  /** Random hidden-phase duration range in ms. Default [2000, 4000]. */
  hiddenRangeMs?: [number, number]
  /**
   * Caps the slot's rendered height so a tall creative can't blow out the
   * layout. This only crops via CSS — it can't force Adsterra to serve a
   * smaller creative. For a reliably compact "just one image" result, pick
   * a fixed-size ad format (e.g. 300x100 or 250x250 banner) in the Adsterra
   * dashboard instead of Native Banner, which auto-fills its container.
   */
  maxHeightPx?: number
}

function randomBetween([min, max]: [number, number]) {
  return min + Math.random() * (max - min)
}

export default function AdsterraNativeBanner({
  adKey = DEFAULT_AD_KEY,
  className = '',
  showLabel = true,
  cycle = false,
  visibleRangeMs = [5000, 9000],
  hiddenRangeMs = [2000, 4000],
  maxHeightPx = 100,
}: AdsterraNativeBannerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const mountedForKey = useRef<string | null>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!cycle) return
    let timer: ReturnType<typeof setTimeout>

    const schedule = (isVisible: boolean) => {
      const range = isVisible ? visibleRangeMs : hiddenRangeMs
      timer = setTimeout(() => {
        setVisible((v) => !v)
      }, randomBetween(range))
    }

    schedule(visible)
    return () => clearTimeout(timer)
    // Re-fires each time `visible` flips, drawing a fresh random delay for
    // the *next* phase — intentionally not memoized on visibleRangeMs alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, visible])

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
    <div
      className={`w-full flex flex-col items-center overflow-hidden transition-[opacity,max-height] duration-500 ease-in-out ${
        cycle && !visible ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${className}`}
      style={{ maxHeight: cycle && !visible ? 0 : maxHeightPx }}
      aria-hidden={cycle && !visible ? true : undefined}
    >
      {showLabel && (
        <span className="text-[9px] uppercase tracking-widest text-gray-300 dark:text-gray-600 font-bold mb-1 select-none">
          Advertisement
        </span>
      )}
      <div ref={wrapperRef} className="w-full flex justify-center min-h-[1px] overflow-hidden" />
    </div>
  )
}
