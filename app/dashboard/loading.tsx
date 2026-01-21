// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0a1e] flex items-center justify-center transition-colors">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
      </div>
    </div>
  )
}
