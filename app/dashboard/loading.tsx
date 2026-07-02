// app/dashboard/loading.tsx
function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-slate-200 dark:bg-white/10 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent" />
    </div>
  )
}

function GameCardSkeleton({ delay = "" }: { delay?: string }) {
  return (
    <div
      className={`bg-white dark:bg-[#1a1429]/50 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-4 flex items-center gap-4 animate-in fade-in duration-500 ${delay}`}
    >
      <Shimmer className="w-12 h-12 shrink-0 rounded-xl" />
      <div className="flex-1 min-w-0 space-y-2">
        <Shimmer className="h-4 w-32 rounded-md" />
        <Shimmer className="h-3 w-44 rounded-md" />
      </div>
      <Shimmer className="w-[18px] h-[18px] rounded-full shrink-0" />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0f0a1e] transition-colors duration-300 pb-24">

      {/* Navbar skeleton */}
      <nav className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Shimmer className="h-7 w-28 rounded-lg" />
          <div className="flex items-center gap-1.5">
            <Shimmer className="h-7 w-20 rounded-md" />
            <Shimmer className="w-7 h-7 rounded-xl" />
          </div>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-8 relative z-10">

        {/* Header skeleton */}
        <header className="py-2">
          <div className="flex items-center gap-3 mb-2">
            <Shimmer className="w-10 h-10 rounded-full shrink-0" />
            <Shimmer className="h-8 w-40 rounded-md" />
          </div>
          <Shimmer className="h-4 w-56 rounded-md" />
        </header>

        {/* Game Collection skeleton */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Shimmer className="w-[18px] h-[18px] rounded-md" />
            <Shimmer className="h-3 w-24 rounded-md" />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <GameCardSkeleton />
            <GameCardSkeleton delay="delay-75" />
            <GameCardSkeleton delay="delay-100" />
            <GameCardSkeleton delay="delay-150" />
            <GameCardSkeleton delay="delay-200" />
          </div>
        </section>
      </main>

      <style jsx global>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
      }
      
