'use client'

import { forwardRef } from 'react'
import AdsterraNativeBanner from './AdsterraNativeBanner'

/** One ad after every Nth list item. */
export const FEED_AD_EVERY = 3

/**
 * Returns the 1-based ad slot that belongs after the list item at `idx`,
 * or null if no ad goes there.
 *
 * Slots are capped at the number of distinct Adsterra zone keys: Adsterra
 * fills a slot by looking up `container-<key>`, so two slots sharing one key
 * means only the first fills and the second renders as a blank gap.
 */
export function getFeedAdSlot(
  idx: number,
  keys: readonly string[],
  maxSlots: number
): number | null {
  if ((idx + 1) % FEED_AD_EVERY !== 0) return null
  const slot = (idx + 1) / FEED_AD_EVERY
  return slot <= Math.min(maxSlots, keys.length) ? slot : null
}

interface FeedAdRowProps {
  adKey: string
  className?: string
}

/**
 * An in-feed ad row. Render it as its OWN keyed sibling (key = `feed-ad-<slot>`)
 * next to the list items — never inside an item's wrapper/Fragment. When it
 * lived inside the item at that position, every re-sort or re-merge of the
 * list (Dexie cache + server data + realtime) remounted the banner and
 * re-fired the Adsterra request over and over.
 *
 * forwardRef so it can sit directly under <AnimatePresence mode="popLayout">,
 * which attaches a ref to each direct child.
 */
const FeedAdRow = forwardRef<HTMLDivElement, FeedAdRowProps>(function FeedAdRow(
  { adKey, className = '' },
  ref
) {
  return (
    <div ref={ref} className={className}>
      <AdsterraNativeBanner adKey={adKey} />
    </div>
  )
})

export default FeedAdRow
