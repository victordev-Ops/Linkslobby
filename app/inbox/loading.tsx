import InboxSkeleton from '@/components/InboxSkeleton'

export default function InboxLoading() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#0f0a1e] transition-colors duration-300">
            <InboxSkeleton />
        </div>
    )
}
