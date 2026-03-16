/**
 * Online status utility.
 * Checks if a user is considered "online" based on their last_seen timestamp.
 *
 * @param lastSeen - ISO timestamp of the user's last activity
 * @returns true if the user was active within the last 2 minutes
 */
export function isUserOnline(lastSeen: string | null): boolean {
    if (!lastSeen) return false
    const diff = Date.now() - new Date(lastSeen).getTime()
    return diff < 2 * 60 * 1000 // 2 minutes
}

/**
 * Format the user's last seen time for display.
 * Returns "Online" if within 2 minutes, otherwise a relative time string.
 */
export function formatLastSeen(lastSeen: string | null): string {
    if (!lastSeen) return 'Offline'
    if (isUserOnline(lastSeen)) return 'Online'

    const diff = Date.now() - new Date(lastSeen).getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
}
