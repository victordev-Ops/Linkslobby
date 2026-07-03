// app/settings/loading.tsx

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3.5 w-28 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
        <div className="h-2.5 w-40 bg-gray-100 dark:bg-white/5 rounded animate-pulse" />
      </div>
    </div>
  )
}

function SectionSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <div>
      <div className="h-2.5 w-24 bg-gray-200 dark:bg-white/10 rounded animate-pulse mb-2 ml-1" />
      <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
        {[...Array(rows)].map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0a1e] transition-colors duration-300 pb-10">

      {/* Ambient BG */}
      <div className="fixed inset-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-gray-100 dark:border-white/10 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 animate-pulse" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 relative z-10">

        {/* Profile card */}
        <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] p-4 flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-white/10 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
            <div className="h-3 w-36 bg-gray-100 dark:bg-white/5 rounded animate-pulse" />
          </div>
          <div className="h-7 w-24 rounded-full bg-gray-100 dark:bg-white/10 animate-pulse shrink-0" />
        </div>

        {/* Preferences */}
        <SectionSkeleton label="Preferences" rows={2} />

        {/* Safety controls */}
        <SectionSkeleton label="Safety controls" rows={4} />

        {/* Subscription */}
        <SectionSkeleton label="Subscription" rows={1} />

        {/* More */}
        <SectionSkeleton label="More" rows={5} />

        {/* Account */}
        <div>
          <div className="h-2.5 w-16 bg-gray-200 dark:bg-white/10 rounded animate-pulse mb-2 ml-1" />
          <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
            <div className="px-4 py-3.5 space-y-1.5">
              <div className="h-2.5 w-12 bg-gray-100 dark:bg-white/5 rounded animate-pulse" />
              <div className="h-3.5 w-40 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
            </div>
            <div className="px-4 py-3.5">
              <div className="h-9 w-full bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
            </div>
            <RowSkeleton />
          </div>
        </div>

      </div>
    </div>
  )
      }
