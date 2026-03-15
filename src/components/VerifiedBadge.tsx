'use client'

import { BadgeCheck } from 'lucide-react'

interface VerifiedBadgeProps {
    size?: number
    className?: string
}

/**
 * Blue verified checkmark badge for Pro users (like X/Twitter).
 * Renders inline next to usernames.
 */
export default function VerifiedBadge({ size = 16, className = '' }: VerifiedBadgeProps) {
    return (
        <BadgeCheck
            size={size}
            className={`text-blue-500 shrink-0 ${className}`}
            fill="currentColor"
            stroke="white"
            strokeWidth={2.5}
        />
    )
}
