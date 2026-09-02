'use client'

import { useEffect, useState } from 'react'
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

/**
 * Mounts an AdsterraNativeBanner only after `delayMs` has passed since this
 * component itself mounted — i.e. `delayMs` after the page/form it lives on
 * loads, not a fixed wall-clock time. Once shown it stays put (unless `cycle`
 * is explicitly enabled) so viewability — and earnings — aren't cut short.
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

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

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
      <div aria-hidden className="h-[140px] w-full shrink-0" />
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 px-3 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] bg-black/50 backdrop-blur-md border-t border-white/10 ${className}`}
      >
        {banner}
      </div>
    </>
  )
}
