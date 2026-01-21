export function formatDistanceToNow(date: Date | string | number, options?: { addSuffix?: boolean }): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const suffix = options?.addSuffix ? " ago" : "";
    const isJustNow = options?.addSuffix ? "just now" : "less than a minute";

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) return isJustNow;
    if (minutes === 1) return `1 minute${suffix}`;
    if (minutes < 60) return `${minutes} minutes${suffix}`;
    if (hours === 1) return `1 hour${suffix}`;
    if (hours < 24) return `${hours} hours${suffix}`;
    if (days === 1) return `1 day${suffix}`;
    if (days < 30) return `${days} days${suffix}`;
    if (months === 1) return `1 month${suffix}`;
    if (months < 12) return `${months} months${suffix}`;
    if (years === 1) return `1 year${suffix}`;
    return `${years} years${suffix}`;
}
