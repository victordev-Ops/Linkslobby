// src/components/InboxClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

  // Realtime subscription for new messages only
  useEffect(() => {
    const channel = supabase
      .channel('confessions-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'confessions',
          filter: `profile_id=eq.${userId}`,
        },
        (payload) => {
          setConfessions((prev) => [payload.new as Confession, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  // Manual refresh (optional)
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

  const openMessage = (id: string) => {
    router.push(`/inbox/${id}`)
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <button onClick={handleRefresh} disabled={refreshing} className="p-2">
          <RefreshCw size={24} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="divide-y divide-gray-200">
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
              onClick={() => openMessage(c.id)}
              className="w-full text-left px-6 py-5 flex items-center gap-4 hover:bg-gray-50 transition"
            >
              <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center shadow-md">
                {c.is_read ? (
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-3 rounded-full">
                    <svg className="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-red-400 via-pink-500 to-orange-400 p-3 rounded-full shadow-lg">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${!c.is_read ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                  {!c.is_read ? 'New Message!' : c.message || 'Empty message'}
                </p>
                <p className="text-sm text-gray-500">{relativeTime(c.created_at)}</p>
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
