'use client'

import { useEffect, useRef, useState } from 'react'
import AdsterraNativeBanner from './AdsterraNativeBanner'

interface AdsterraDelayedSlotProps {
  /** Zone key from the Adsterra dashboard. Defaults to AdsterraNativeBanner's default. */
  adKey?: string
  /** Delay before the ad slot mounts, in milliseconds. Defaults to 6s. */
  delayMs?: number
  className?: string
  /** Fade the slot in/out on a loop once mounted, instead of staying static. */
  cycle?: boolean
  /** Random visible-phase duration range in ms. Default [5000, 9000]. */
  visibleRangeMs?: [number, number]
  /** Random hidden-phase duration range in ms. Default [2000, 4000]. */
  hiddenRangeMs?: [number, number]
  /** Caps the slot's rendered height in px. Default 100. */
  maxHeightPx?: number
  /**
   * After the delay, pin the ad to the bottom of the viewport so it keeps
   * earning impressions instead of sitting below the fold (or cycling away).
   */
  stick?: boolean
}

/** Breathing room between the last piece of page content and the pinned bar. */
const SPACER_GAP_PX = 16

/**
 * Mounts an AdsterraNativeBanner only after `delayMs` has passed since this
 * component itself mounted — i.e. `delayMs` after the page/form it lives on
 * loads, not a fixed wall-clock time. Once shown it stays put (unless `cycle`
 * is explicitly enabled) so viewability — and earnings — aren't cut short.
 *
 * With `stick`, the banner is pinned to the bottom of the viewport. An
 * in-flow spacer reserves exactly as much room as the pinned bar occupies
 * (measured with a ResizeObserver, so it follows the real creative height
 * as the ad loads) — the page can always be scrolled far enough that the
 * bar never sits on top of a CTA button.
 */
export default function AdsterraDelayedSlot({
  adKey,
  delayMs = 6000,
  className = '',
  cycle = false,
  visibleRangeMs,
  hiddenRangeMs,
  maxHeightPx,
  stick = false,
}: AdsterraDelayedSlotProps) {
  const [visible, setVisible] = useState(false)
  const [barHeight, setBarHeight] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  // Keep the spacer exactly as tall as the pinned bar. The old fixed 140px
  // spacer was shorter than the bar whenever the creative was taller than
  // ~100px, which is what let the bar overlap the page's CTA button.
  useEffect(() => {
    if (!stick || !visible) return
    const el = barRef.current
    if (!el) return

    const measure = () => setBarHeight(Math.ceil(el.getBoundingClientRect().height))
    measure()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [stick, visible])

  if (!visible) return null

  const banner = (
    <AdsterraNativeBanner
      adKey={adKey}
      className={stick ? '' : className}
      cycle={cycle}
      visibleRangeMs={visibleRangeMs}
      hiddenRangeMs={hiddenRangeMs}
      maxHeightPx={maxHeightPx}
    />
  )

  if (!stick) return banner

  return (
    <>
      <div
        aria-hidden
        className="w-full shrink-0"
        style={{ height: barHeight + SPACER_GAP_PX }}
      />
      <div
        ref={barRef}
        className={`fixed bottom-0 left-0 right-0 z-40 px-3 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] bg-black/50 backdrop-blur-md border-t border-white/10 ${className}`}
      >
        {banner}
      </div>
    </>
  )
}
