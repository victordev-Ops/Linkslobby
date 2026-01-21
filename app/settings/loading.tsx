// app/settings/loading.tsx
export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0a1e]">
      <div className="bg-white dark:bg-[#1a1429] border-b dark:border-white/10 sticky top-0 z-10 transition-colors">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
            <div className="hidden sm:block w-32 h-4 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
          </div>
          <div className="h-8 w-32 bg-gray-300 dark:bg-white/10 rounded animate-pulse ml-auto" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 transition-colors">
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-24 h-24 bg-gray-200 dark:bg-white/5 rounded-full animate-pulse mb-4" />
                <div className="h-8 w-48 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-36 bg-gray-200 dark:bg-white/5 rounded animate-pulse mt-2" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 transition-colors">
              <div className="h-6 w-24 bg-gray-300 dark:bg-white/10 rounded animate-pulse mb-6" />
              <div className="space-y-4">
                <div className="h-4 w-full bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                <div className="h-10 w-32 bg-gray-300 dark:bg-white/10 rounded animate-pulse mt-6" />
              </div>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="bg-white dark:bg-[#1a1429]/50 dark:backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 sticky top-24 transition-colors">
              <div className="h-6 w-32 bg-gray-300 dark:bg-white/10 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-4 w-24 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
