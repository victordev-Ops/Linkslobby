// app/profile/loading.tsx
function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-slate-200 dark:bg-white/10 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent" />
    </div>
  )
}

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24">

      {/* Background Ambience (Dark Mode only) — matches the real profile page's glow */}
      <div className="fixed inset-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Cover Photo Banner skeleton */}
      <div className="h-40 relative bg-gradient-to-tr from-purple-600/40 via-indigo-600/40 to-blue-500/40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-[#F8F9FD] dark:to-[#0f0a1e]" />
        <div className="absolute top-0 left-0 right-0 px-4 py-4 flex items-center justify-between z-10">
          <div className="w-9 h-9 rounded-full bg-black/20" />
          <div className="w-24 h-9 rounded-full bg-black/20" />
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-0 sm:px-4 -mt-16 relative z-10">
        {/* Profile Card skeleton */}
        <div className="bg-white dark:bg-[#1a1429]/80 dark:backdrop-blur-xl sm:rounded-3xl shadow-sm border-b sm:border border-slate-200 dark:border-white/10 pt-4 pb-6 px-6">

          {/* Avatar row */}
          <div className="flex items-start justify-between gap-4">
            <Shimmer className="w-24 h-24 sm:w-28 sm:h-28 rounded-full -mt-12 sm:-mt-14 ring-4 ring-white dark:ring-[#1a1429]" />
            <div className="flex items-center gap-2 pt-3 shrink-0">
              <Shimmer className="h-9 w-24 rounded-xl" />
              <Shimmer className="h-9 w-20 rounded-xl" />
            </div>
          </div>

          {/* Info block */}
          <div className="mt-3 space-y-2">
            <Shimmer className="h-6 w-40 rounded-md" />
            <Shimmer className="h-4 w-28 rounded-md" />
            <Shimmer className="h-4 w-full max-w-sm rounded-md mt-3" />
            <Shimmer className="h-4 w-2/3 max-w-xs rounded-md" />
          </div>

          {/* Stats row skeleton */}
          <div className="flex items-center justify-between gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/60">
            <div className="flex gap-8">
              <div className="space-y-1.5">
                <Shimmer className="h-5 w-6 rounded-md" />
                <Shimmer className="h-3 w-14 rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Shimmer className="h-5 w-6 rounded-md" />
                <Shimmer className="h-3 w-16 rounded-md" />
              </div>
              <div className="space-y-1.5 hidden sm:block">
                <Shimmer className="h-5 w-10 rounded-md" />
                <Shimmer className="h-3 w-12 rounded-md" />
              </div>
            </div>
            <Shimmer className="h-7 w-16 rounded-md" />
          </div>

          {/* Friends section skeleton */}
          <div className="border-t border-slate-100 dark:border-slate-800/60 -mx-6 px-6 mt-2 pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Shimmer className="h-9 w-36 sm:w-44 rounded-xl" />
              <Shimmer className="h-9 w-9 rounded-xl" />
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Shimmer className="w-16 h-16 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <Shimmer className="h-4 w-32 rounded-md" />
                    <Shimmer className="h-3 w-24 rounded-md" />
                  </div>
                  <Shimmer className="h-9 w-20 rounded-xl shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Plain <style> tag on purpose — loading.tsx is a Server Component,
          and `style jsx` needs the client-only styled-jsx runtime, which
          breaks the Turbopack build. A static <style> tag has no such
          requirement. */}
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
              }
