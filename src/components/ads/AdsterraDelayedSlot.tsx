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
}

/**
 * Mounts an AdsterraNativeBanner only after `delayMs` has passed since this
 * component itself mounted — i.e. `delayMs` after the page/form it lives on
 * loads, not a fixed wall-clock time. Renders nothing until then, so there's
 * no layout shift reserved up front for an ad that isn't there yet.
 */
export default function AdsterraDelayedSlot({
  adKey,
  delayMs = 6000,
  className = '',
  cycle = false,
  visibleRangeMs,
  hiddenRangeMs,
  maxHeightPx,
}: AdsterraDelayedSlotProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  if (!visible) return null

  return (
    <AdsterraNativeBanner
      adKey={adKey}
      className={className}
      cycle={cycle}
      visibleRangeMs={visibleRangeMs}
      hiddenRangeMs={hiddenRangeMs}
      maxHeightPx={maxHeightPx}
    />
  )
}
