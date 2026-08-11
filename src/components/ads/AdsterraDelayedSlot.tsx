'use client'

import { useEffect, useState } from 'react'
import AdsterraNativeBanner from './AdsterraNativeBanner'

interface AdsterraDelayedSlotProps {
  /** Zone key from the Adsterra dashboard. Defaults to AdsterraNativeBanner's default. */
  adKey?: string
  /** Delay before the ad slot mounts, in milliseconds. Defaults to 6s. */
  delayMs?: number
  className?: string
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
}: AdsterraDelayedSlotProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  if (!visible) return null

  return <AdsterraNativeBanner adKey={adKey} className={className} />
}
