'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, MessageSquare, ChevronRight, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { markConfessionAsRead } from '@/actions/confessions'
import { useNotifications } from '@/context/NotificationContext'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
// IMPORT THE VIEW COMPONENT
import MessageViewClient from './MessageViewClient'

type Confession = {
  id: string
  message: string
  created_at: string
  is_read: boolean
  profile_id: string
  message_type: 'confession' | 'ama' | 'anonymous' | 'direct_message'
}

const PAGE_SIZE = 20

// --- HELPERS ---
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

const mergeConfessions = (current: Confession[], incoming: Confession[]): Confession[] => {
  const map = new Map<string, Confession>()
    ;[...current, ...incoming].forEach(item => map.set(item.id, item))
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

const formatRelativeTime = (dateString: string): string => {
  const now = new Date()
  const then = new Date(dateString)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`

  return then.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function InboxClient({
  initialConfessions,
  userId,
  username // ADDED: Needed for the view component
}: {
  initialConfessions: Confession[]
  userId: string
  username: string
}) {
  const [confessions, setConfessions] = useState<Confession[]>(initialConfessions)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'All' | 'Confessions' | 'AMA' | 'Anonymous' | 'DMs'>('All')

  // Pagination state
  const [hasMore, setHasMore] = useState(initialConfessions.length >= PAGE_SIZE)
  const [loadingMore, setLoadingMore] = useState(false)

  // NEW: State for the instant preview overlay
  const [selectedConfession, setSelectedConfession] = useState<Confession | null>(null)

  const hasMounted = useRef(false)
  const supabase = useRef(createClient()).current

  const { setUnreadCount, refreshUnreadCount } = useNotifications()
  const router = useRouter()

  const debouncedRefreshUnreadCount = useMemo(
    () => debounce(() => {
      refreshUnreadCount().catch(console.error)
    }, 300),
    [refreshUnreadCount]
  )

  // --- 1. CORE FETCH LOGIC ---
  const fetchLatest = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true)
      setError(null)
      if (window.navigator.vibrate) window.navigator.vibrate(10)
    }

    try {
      const { data, error: supabaseError } = await supabase
        .from('confessions')
        .select('id, message, created_at, is_read, profile_id, message_type')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (supabaseError) throw supabaseError

      if (data) {
        setConfessions(prev => mergeConfessions(prev, data))
        queueMicrotask(() => {
          refreshUnreadCount().catch(console.error)
        })
        if (isManual) toast.success('Inbox updated')
      }
    } catch (err) {
      console.error('Fetch error:', err)
      if (isManual) {
        setError('Failed to load messages.')
        toast.error('Sync failed')
      }
    } finally {
      if (isManual) setTimeout(() => setRefreshing(false), 600)
    }
  }, [userId, supabase, refreshUnreadCount])

  // --- LOAD MORE (Pagination) ---
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || confessions.length === 0) return
    setLoadingMore(true)

    const lastItem = confessions[confessions.length - 1]
    try {
      const { data, error: supabaseError } = await supabase
        .from('confessions')
        .select('id, message, created_at, is_read, profile_id, message_type')
        .eq('profile_id', userId)
        .lt('created_at', lastItem.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (supabaseError) throw supabaseError

      if (data) {
        setConfessions(prev => mergeConfessions(prev, data))
        setHasMore(data.length >= PAGE_SIZE)
      }
    } catch (err) {
      console.error('Load more error:', err)
      toast.error('Failed to load more messages')
    } finally {
      setLoadingMore(false)
    }
  }, [confessions, userId, supabase, hasMore, loadingMore])

  // --- 2. SYNC SERVER PROPS ---
  useEffect(() => {
    setConfessions(prev => mergeConfessions(prev, initialConfessions))
    const unread = initialConfessions.filter(c => !c.is_read).length
    setUnreadCount(unread)

    if (!hasMounted.current) {
      fetchLatest(false)
      hasMounted.current = true
    }
  }, [initialConfessions, setUnreadCount, fetchLatest])

  // --- 3. REALTIME LISTENER ---
  useEffect(() => {
    const channel = supabase
      .channel(`inbox-realtime-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'confessions',
        filter: `profile_id=eq.${userId}`,
      },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Confession
            setConfessions((prev) => mergeConfessions(prev, [newMsg]))
            queueMicrotask(() => debouncedRefreshUnreadCount())

            toast('New secret message! 💌', {
              description: 'Tap to view',
              action: {
                label: 'View',
                onClick: () => setSelectedConfession(newMsg) // Update to use state
              }
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Confession
            setConfessions((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            )
            queueMicrotask(() => debouncedRefreshUnreadCount())
          } else if (payload.eventType === 'DELETE') {
            setConfessions((prev) => prev.filter((c) => c.id !== payload.old.id))
            queueMicrotask(() => debouncedRefreshUnreadCount())
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, debouncedRefreshUnreadCount])

  // --- 4. ACTION HANDLERS ---
  const handleRefresh = useCallback(() => {
    fetchLatest(true)
  }, [fetchLatest])

  const filteredConfessions = useMemo(() => {
    if (activeTab === 'All') return confessions
    return confessions.filter(c => {
      if (activeTab === 'Confessions') return c.message_type === 'confession'
      if (activeTab === 'AMA') return c.message_type === 'ama'
      if (activeTab === 'Anonymous') return c.message_type === 'anonymous'
      if (activeTab === 'DMs') return c.message_type === 'direct_message'
      return true
    })
  }, [confessions, activeTab])

  const openMessage = useCallback(async (confession: Confession) => {
    // 1. INSTANTLY OPEN (State update = ~0ms delay)
    setSelectedConfession(confession)

    // 2. Background Logic (Optimistic update & Server sync)
    if (!confession.is_read) {
      // Optimistic update local list
      setConfessions((prev) =>
        prev.map((c) => (c.id === confession.id ? { ...c, is_read: true } : c))
      )

      // Fire and forget server update
      markConfessionAsRead(confession.id).catch(err => {
        console.error('Mark as read error:', err)
      })

      queueMicrotask(() => debouncedRefreshUnreadCount())
    }
  }, [debouncedRefreshUnreadCount])

  const closeMessage = () => setSelectedConfession(null)

  // --- RENDER ---
  if (error && confessions.length === 0) {
    return <ErrorState retry={handleRefresh} message={error} />
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0a1e] pb-32 relative transition-colors">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 dark:bg-[#0f0a1e]/80 backdrop-blur-md border-b border-gray-100 dark:border-white/10 z-10 px-6 py-4 flex items-center justify-between transition-colors">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Inbox</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all active:scale-90 disabled:opacity-50 text-gray-500 dark:text-gray-400"
        >
          <RefreshCw
            size={20}
            className={`transition-transform ${refreshing ? 'animate-spin text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}
          />
        </button>
      </div>

      {/* Grouping Tabs */}
      <div className="px-6 pb-4 overflow-x-auto no-scrollbar">
        <div className="flex bg-gray-50 dark:bg-white/5 p-1 rounded-2xl border border-gray-100 dark:border-white/10 w-max min-w-full">
          {(['All', 'Confessions', 'AMA', 'Anonymous', 'DMs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === tab
                ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Message List */}
      <div className="divide-y divide-gray-50 dark:divide-white/5">
        <AnimatePresence mode="popLayout" initial={false}>
          {filteredConfessions.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState />
            </motion.div>
          ) : (
            filteredConfessions.map((c) => {
              const isSecret = !c.is_read && (c.message_type === 'confession' || c.message_type === 'anonymous')
              const displayMessage = isSecret ? 'Locked message - Tap to reveal' : (c.message.length > 80 ? c.message.slice(0, 80) + '...' : c.message)

              return (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  key={c.id}
                  onClick={() => openMessage(c)}
                  className="w-full text-left px-6 py-5 flex items-start gap-4 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors active:bg-gray-100 dark:active:bg-white/10 group"
                >
                  {/* Message Icon */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-all duration-300 ${c.is_read
                      ? 'bg-gray-100 dark:bg-white/10 grayscale dark:grayscale-0 dark:opacity-50'
                      : 'bg-gradient-to-tr from-purple-500 to-pink-500 shadow-purple-200 dark:shadow-purple-900/20'
                      }`}>
                      {c.message_type === 'ama' ? '❓' : c.message_type === 'direct_message' ? '💬' : '💌'}
                    </div>
                    {!c.is_read && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-[#0f0a1e]" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className={`text-[10px] tracking-widest uppercase font-black ${c.is_read ? 'text-gray-400 dark:text-gray-500' : 'text-purple-600 dark:text-purple-400'
                        }`}>
                        {c.is_read ? c.message_type : `New ${c.message_type}`}
                      </p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                        {formatRelativeTime(c.created_at)}
                      </span>
                    </div>
                    <p className={`text-base line-clamp-2 leading-relaxed ${c.is_read
                      ? 'text-gray-500 dark:text-gray-400'
                      : isSecret ? 'text-purple-400 dark:text-purple-600 font-medium italic' : 'text-gray-900 dark:text-white font-semibold'
                      }`}>
                      {displayMessage}
                    </p>
                  </div>

                  <ChevronRight
                    size={18}
                    className="text-gray-300 dark:text-gray-600 mt-5 group-hover:translate-x-1 transition-transform"
                  />
                </motion.button>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* Load More Button */}
      {hasMore && filteredConfessions.length > 0 && (
        <div className="px-6 py-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-3 px-4 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 font-medium text-sm hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingMore ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Messages'
            )}
          </button>
        </div>
      )}

      {/* --- INSTANT PREVIEW OVERLAY --- */}
      <AnimatePresence>
        {selectedConfession && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 bg-white dark:bg-[#0f0a1e]"
            style={{ willChange: 'transform' }} // Optimization
          >
            <MessageViewClient
              confession={selectedConfession}
              username={username}
              onClose={closeMessage}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- Sub-Components ---
function ErrorState({ retry, message }: { retry: () => void; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
        <AlertCircle size={32} />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Unable to sync</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">{message}</p>
      <button onClick={retry} className="bg-gray-900 dark:bg-white text-white dark:text-black px-8 py-2.5 rounded-xl font-bold active:scale-95 transition-transform hover:bg-gray-800 dark:hover:bg-gray-200">
        Try Again
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20 px-6">
      <div className="bg-purple-50 dark:bg-purple-500/10 w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
        <MessageSquare className="w-10 h-10 text-purple-300 dark:text-purple-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Your inbox is empty</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto text-sm">
        Share your profile link with others to get anonymous messages.
      </p>
      <Link href="/dashboard" className="inline-block bg-purple-600 dark:bg-purple-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-purple-100 dark:shadow-purple-900/20 active:scale-95 transition-transform hover:bg-purple-700">
        Get My Link
      </Link>
    </div>
  )
}
