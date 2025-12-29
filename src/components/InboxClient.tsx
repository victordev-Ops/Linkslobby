// components/InboxClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation' // Use standard router
import { markConfessionAsRead } from '@/app/actions/confessions' // Import the action

// ... (Keep your Type Definitions here) ...
type Confession = {
  id: string
  message: string
  created_at: string
  is_read: boolean
  profile_id: string
}

type Props = {
  initialConfessions: Confession[]
  userId: string
}

export default function InboxClient({ initialConfessions, userId }: Props) {
  const [confessions, setConfessions] = useState<Confession[]>(initialConfessions)
  const [refreshing, setRefreshing] = useState(false)
  
  const supabase = createClient()
  const router = useRouter()

  // ... (Keep your useEffect for Realtime here - it is good) ...
  useEffect(() => {
    const channel = supabase
      .channel('confessions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to ALL events to catch updates too
          schema: 'public',
          table: 'confessions',
          filter: `profile_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setConfessions((prev) => [payload.new as Confession, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setConfessions((prev) => 
              prev.map(c => c.id === payload.new.id ? payload.new as Confession : c)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  // ... (Keep handleRefresh and relativeTime and truncate) ...
    const handleRefresh = async () => {
    setRefreshing(true)
    const { data } = await supabase
      .from('confessions')
      .select('id, message, created_at, is_read, profile_id')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })

    if (data) setConfessions(data)
    setRefreshing(false)
  }

  const relativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`
    return `${Math.floor(diff / 31536000)}y ago`
  }

  const truncate = (text: string, max: number = 100) => {
    if (!text) return 'Empty message'
    return text.length <= max ? text : text.slice(0, max).trim() + '...'
  }

  // --- THE FIXED FUNCTION ---
  const openMessage = async (confession: Confession) => {
    // 1. Immediate Navigation (Feels fastest to user)
    router.push(`/inbox/${confession.id}`)

    // 2. Optimistic UI Update
    // Even though we navigated away, if they click "Back" quickly, 
    // the state helps, but the revalidatePath is the real fix.
    if (!confession.is_read) {
      setConfessions((prev) =>
        prev.map((c) => (c.id === confession.id ? { ...c, is_read: true } : c))
      )

      // 3. Server Action (Background)
      // We do NOT await this. We let it run in the background.
      // It will update DB and mark /inbox as dirty on the server.
      markConfessionAsRead(confession.id)
    }
  }

  return (
    // ... (Your existing JSX remains exactly the same) ...
     <div className="min-h-screen bg-white pb-32">
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <button onClick={handleRefresh} disabled={refreshing} className="p-2">
          <RefreshCw size={24} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {confessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-gray-100 w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gray-800 mb-2">No messages yet</h3>
            <p className="text-gray-500 mb-8">Share your link and check back soon!</p>
            <Link href="/dashboard" className="text-purple-600 font-medium">
              Go to Dashboard →
            </Link>
          </div>
        ) : (
          confessions.map((c) => (
            <button
              key={c.id}
              onClick={() => openMessage(c)}
              className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
            >
              <div className="w-14 h-14 rounded-full flex-shrink-0 shadow-md flex items-center justify-center">
                {c.is_read ? (
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-2xl">💌</span>
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-red-400 via-pink-500 to-orange-400 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-2xl">💌</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-base leading-snug ${
                    c.is_read ? 'text-gray-800' : 'text-red-600 font-bold'
                  }`}
                >
                  {c.is_read ? truncate(c.message) : 'New Message!'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {relativeTime(c.created_at)}
                </p>
              </div>

              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))
        )}
      </div>
    </div>
  )
                                                  }
                     
