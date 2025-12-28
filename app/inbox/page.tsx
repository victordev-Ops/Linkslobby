//Refactor this inbox code so that when user opens a message it opens like ngl and it's mark as read. User can now reply to the message by sharing it on social media. // app/inbox/page.tsx
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

export default function InboxPage() {
  const [confessions, setConfessions] = useState<Confession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()

  // Get current user once on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/dashboard')
        return
      }
      setCurrentUserId(user.id)
    }
    getUser()
  }, [router])

  const fetchConfessions = async () => {
    if (!currentUserId) return

    const { data } = await supabase
      .from('confessions')
      .select('id, message, created_at, is_read, profile_id')
      .eq('profile_id', currentUserId)
      .order('created_at', { ascending: false })

    setConfessions(data || [])
    setLoading(false)
    setRefreshing(false)

    // Mark all as read
    const hasUnread = data?.some(c => !c.is_read)
    if (hasUnread) {
      await supabase
        .from('confessions')
        .update({ is_read: true })
        .eq('profile_id', currentUserId)
        .eq('is_read', false)
    }
  }

  // Initial load + refresh
  useEffect(() => {
    if (currentUserId) {
      fetchConfessions()
    }
  }, [currentUserId])

  // Pull to refresh
  const handleRefresh = () => {
    setRefreshing(true)
    fetchConfessions()
  }

  // Real-time subscription
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel('confessions-rt')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'confessions',
        },
        (payload) => {
          const newConfession = payload.new as Confession
          // Only add if it's for the current user
          if (newConfession.profile_id === currentUserId) {
            setConfessions(prev => [newConfession, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  // Relative time formatter
  const relativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`
    return `${Math.floor(diffInSeconds / 31536000)}y ago`
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={24} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {refreshing && <div className="py-2 text-center"><RefreshCw className="animate-spin inline" size={28} /></div>}

      <div className="divide-y divide-gray-200">
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="px-6 py-5 flex items-center gap-4 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))
        ) : confessions.length === 0 ? (
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
            <div key={c.id} className="px-6 py-5 flex items-center gap-4 hover:bg-gray-50 transition">
              {/* Envelope Icon */}
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

              {/* Message Preview */}
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${!c.is_read ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                  {!c.is_read ? 'New Message!' : c.message || 'Empty message'}
                </p>
                <p className="text-sm text-gray-500">
                  {relativeTime(c.created_at)}
                </p>
              </div>

              {/* Chevron */}
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
