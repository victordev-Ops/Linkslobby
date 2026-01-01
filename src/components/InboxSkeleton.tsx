// components/InboxSkeleton.tsx
export default function InboxSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header Skeleton */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="h-8 w-24 bg-gray-100 animate-pulse rounded-lg" />
        <div className="h-10 w-10 bg-gray-100 animate-pulse rounded-full" />
      </div>

      {/* List Skeletons */}
      <div className="divide-y divide-gray-50">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="px-6 py-5 flex items-start gap-4">
            {/* Icon Skeleton */}
            <div className="w-12 h-12 bg-gray-100 animate-pulse rounded-2xl flex-shrink-0" />
            
            <div className="flex-1 space-y-3">
              <div className="flex justify-between">
                {/* Status/Tag Skeleton */}
                <div className="h-3 w-20 bg-gray-100 animate-pulse rounded" />
                {/* Time Skeleton */}
                <div className="h-3 w-12 bg-gray-50 animate-pulse rounded" />
              </div>
              {/* Message Lines */}
              <div className="h-4 w-full bg-gray-100 animate-pulse rounded" />
              <div className="h-4 w-2/3 bg-gray-50 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
