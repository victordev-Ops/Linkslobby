'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, MessageSquare, ChevronRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { markConfessionAsRead } from 'app/actions/confessions'
import { useNotifications } from '@/context/NotificationContext'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

type Confession = {
  id: string
  message: string
  created_at: string
  is_read: boolean
  profile_id: string
}

export default function InboxClient({ initialConfessions, userId }: { initialConfessions: Confession[], userId: string }) {
  // 1. Local State initialized with server data
  const [confessions, setConfessions] = useState<Confession[]>(initialConfessions)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
 
  const { setUnreadCount } = useNotifications()
  const supabase = createClient()
  const router = useRouter()

  // 2. Sync State when Server Data updates (via router.refresh)
  useEffect(() => {
    setConfessions(initialConfessions)
    const unread = initialConfessions.filter(c => !c.is_read).length
    setUnreadCount(unread)
  }, [initialConfessions, setUnreadCount])

  // 3. Robust Realtime Listener
  useEffect(() => {
    const channel = supabase
      .channel(`inbox-realtime-${userId}`)
      .on('postgres_changes', {
          event: '*', // Listen for INSERTS, UPDATES, and DELETES
          schema: 'public',
          table: 'confessions',
          filter: `profile_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Confession
            setConfessions((prev) => [newMsg, ...prev])
            setUnreadCount((prev) => prev + 1)
            toast('New secret message! 💌', {
              description: 'Tap to view',
              action: { label: 'View', onClick: () => router.push(`/inbox/${newMsg.id}`) }
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Confession
            setConfessions((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            )
          } else if (payload.eventType === 'DELETE') {
            setConfessions((prev) => prev.filter((c) => c.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase, setUnreadCount, router])

  // 4. Manual Refresh (The "Hard Reset")
  const handleRefresh = async () => {
    if (refreshing) return
    
    try {
      setRefreshing(true)
      setError(null)
      if (window.navigator.vibrate) window.navigator.vibrate(10)

      const { data, error: supabaseError } = await supabase
        .from('confessions')
        .select('*')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })

      if (supabaseError) throw supabaseError

      if (data) {
        setConfessions(data)
        const unread = data.filter(c => !c.is_read).length
        setUnreadCount(unread)
        router.refresh()
        toast.success('Inbox updated')
      }
    } catch (err) {
      setError('Failed to load messages.')
      toast.error('Sync failed')
    } finally {
      setTimeout(() => setRefreshing(false), 600)
    }
  }

  // 5. Optimistic Message Opening
  const openMessage = async (confession: Confession) => {
    const originalConfessions = [...confessions]
   
    // Navigate immediately for speed
    router.push(`/inbox/${confession.id}`)

    if (!confession.is_read) {
      // Optimistically update UI
      setUnreadCount((prev) => Math.max(0, prev - 1))
      setConfessions((prev) =>
        prev.map((c) => (c.id === confession.id ? { ...c, is_read: true } : c))
      )

      try {
        const result = await markConfessionAsRead(confession.id)
        if (result?.error) throw new Error(result.error)
      } catch (err) {
        // Rollback on failure
        setConfessions(originalConfessions)
        setUnreadCount((prev) => prev + 1)
        toast.error('Sync error')
      }
    }
  }

  if (error && confessions.length === 0) {
    return <ErrorState retry={handleRefresh} message={error} />
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-10 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Inbox</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 rounded-full transition-all active:scale-90 disabled:opacity-50"
          aria-label="Refresh messages"
        >
          <RefreshCw size={20} className={`${refreshing ? 'animate-spin text-purple-600' : 'text-gray-500'}`} />
        </button>
      </div>

      {/* Message List */}
      <div className="divide-y divide-gray-50">
        <AnimatePresence mode="popLayout" initial={false}>
          {confessions.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
            >
              <EmptyState />
            </motion.div>
          ) : (
            confessions.map((c) => (
              <motion.button
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={c.id}
                onClick={() => openMessage(c)}
                className="w-full text-left px-6 py-5 flex items-start gap-4 hover:bg-gray-50/50 transition-colors active:bg-gray-100 group"
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-all duration-500 ${
                    c.is_read ? 'bg-gray-100 grayscale' : 'bg-gradient-to-tr from-purple-500 to-pink-500 shadow-purple-200'
                  }`}>
                    💌
                  </div>
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex justify-between items-baseline mb-1">
                    <p className={`text-[10px] tracking-widest uppercase font-black ${c.is_read ? 'text-gray-400' : 'text-purple-600'}`}>
                      {c.is_read ? 'Opened' : 'New Message'}
                    </p>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className={`text-base line-clamp-2 leading-relaxed ${c.is_read ? 'text-gray-500' : 'text-gray-900 font-semibold'}`}>
                    {c.is_read ? c.message : "You received a new secret message..."}
                  </p>
                </div>

                <ChevronRight size={18} className="text-gray-300 mt-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// --- Sub-Components ---

function ErrorState({ retry, message }: { retry: () => void, message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
        <AlertCircle size={32} />
      </div>
      <h3 className="text-lg font-bold text-gray-900">Unable to sync</h3>
      <p className="text-gray-500 mb-6 text-sm">{message}</p>
      <button onClick={retry} className="bg-gray-900 text-white px-8 py-2.5 rounded-xl font-bold active:scale-95 transition-transform">
        Try Again
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20 px-6">
      <div className="bg-purple-50 w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
        <MessageSquare className="w-10 h-10 text-purple-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Your inbox is empty</h3>
      <p className="text-gray-500 mb-8 max-w-xs mx-auto text-sm">Share your profile link with others to get anonymous messages.</p>
      <Link href="/dashboard" className="inline-block bg-purple-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-purple-100 active:scale-95 transition-transform">
        Get My Link
      </Link>
    </div>
  )
         }
    
