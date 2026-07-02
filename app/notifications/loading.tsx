export default function NotificationsLoading() {
    return (
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24 animate-pulse">
            {/* Header skeleton — mirrors the real sticky header */}
            <div className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30 px-4 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10 shrink-0" />
                <div className="h-5 w-32 rounded-md bg-slate-200 dark:bg-white/10 flex-1" />
                <div className="h-8 w-16 rounded-xl bg-slate-200 dark:bg-white/10 shrink-0" />
                <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-white/10 shrink-0" />
            </div>

            <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
                {/* Tab pills skeleton */}
                <div className="flex gap-2 overflow-hidden">
                    {[16, 20, 16, 14, 20].map((w, i) => (
                        <div
                            key={i}
                            className="h-6 rounded-full bg-slate-200 dark:bg-white/10 shrink-0"
                            style={{ width: `${w * 4}px` }}
                        />
                    ))}
                </div>

                {/* Notification card skeletons */}
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="relative p-4 rounded-2xl bg-white dark:bg-[#1a1429]/50 border border-slate-200 dark:border-white/10 flex gap-4"
                            style={{ opacity: 1 - i * 0.08 }}
                        >
                            {/* Icon circle */}
                            <div className="w-12 h-12 shrink-0 rounded-xl bg-slate-200 dark:bg-white/10" />

                            <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="h-4 rounded-md bg-slate-200 dark:bg-white/10 w-3/5" />
                                    <div className="h-3 w-10 rounded-md bg-slate-200 dark:bg-white/10 shrink-0" />
                                </div>
                                <div className="h-3 rounded-md bg-slate-200 dark:bg-white/10 w-4/5" />
                                {i % 3 === 0 && (
                                    <div className="h-7 w-24 rounded-xl bg-slate-200 dark:bg-white/10 mt-1" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    )
}
