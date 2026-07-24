"use client"

import { Star } from 'lucide-react'

/**
 * "+200 ★★★" — the shared way of rendering a Stars amount everywhere it
 * shows up (XP toast, /stars transaction list). Uses the same orange,
 * filled-star treatment as XPBalance.tsx so a number always reads as
 * "Stars" rather than a generic XP figure. The 3-star cluster (shrinking,
 * fading) is a fixed decorative flourish — not a literal count of
 * anything about the transaction.
 */
export function StarAmount({
  amount,
  type = 'earn',
  size = 'default',
}: {
  amount: number
  type?: 'earn' | 'spend'
  size?: 'default' | 'sm'
}) {
  const isEarning = type === 'earn'
  const numberSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const starSizes = size === 'sm'
    ? ['w-2.5 h-2.5', 'w-2 h-2', 'w-1.5 h-1.5']
    : ['w-3 h-3', 'w-2.5 h-2.5', 'w-2 h-2']

  return (
    <span className="inline-flex items-center gap-1">
      <span className={`font-bold ${numberSize} ${isEarning ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {isEarning ? '+' : '-'}{Math.abs(amount).toLocaleString()}
      </span>
      <span className="flex items-center -space-x-0.5">
        {starSizes.map((s, i) => (
          <Star
            key={i}
            className={`${s} fill-orange-500 dark:fill-orange-400 text-orange-500 dark:text-orange-400`}
            style={{ opacity: 1 - i * 0.25 }}
          />
        ))}
      </span>
    </span>
  )
}
