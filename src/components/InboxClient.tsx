'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, MessageSquare, ChevronRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { markConfessionAsRead } from 'app/actions/confessions'
import { useNotifications } from '@/context/NotificationContext'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner' // Recommended for Next.js

type Confession = {
  id: string
  message: string
  created_at: string
  is_read: boolean
  profile_id: string
}

export default function InboxClient({ initialConfessions, userId }: { initialConfessions: Confession[], userId: string }) {
  const [confessions, setConfessions] = useState<Confession[]>(initialConfessions)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { setUnreadCount } = useNotifications()
  const supabase = createClient()
  const router = useRouter()

  // Real-time listener
  useEffect(() => {
    const channel = supabase
      .channel('confessions-inbox-sync')
      .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'confessions',
          filter: `profile_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setConfessions((prev) => [payload.new as Confession, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setConfessions((prev) =>
              prev.map((c) => (c.id === payload.new.id ? (payload.new as Confession) : c))
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  const handleRefresh = async () => {
    try {
      setError(null)
      setRefreshing(true)
      
      if (typeof window !== 'undefined' && window.navigator.vibrate) {
        window.navigator.vibrate(10)
      }

      const { data, error: supabaseError } = await supabase
        .from('confessions')
        .select('*')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })

      if (supabaseError) throw supabaseError

      if (data) {
        setConfessions(data)
        router.refresh()
        toast.success('Inbox updated')
      }
    } catch (err) {
      setError('Failed to load messages. Please check your connection.')
      toast.error('Sync failed')
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }

  const openMessage = async (confession: Confession) => {
    // Save original states for potential rollback
    const originalConfessions = [...confessions]
    
    // 1. Immediate Navigation
    router.push(`/inbox/${confession.id}`)

    if (!confession.is_read) {
      // 2. Optimistic Updates
      setUnreadCount((prev) => Math.max(0, prev - 1))
      setConfessions((prev) =>
        prev.map((c) => (c.id === confession.id ? { ...c, is_read: true } : c))
      )

      // 3. Background Server Action with Error Handling
      try {
        const result = await markConfessionAsRead(confession.id)
        if (result?.error) throw new Error(result.error)
      } catch (err) {
        // 4. Rollback on failure
        setConfessions(originalConfessions)
        setUnreadCount((prev) => prev + 1)
        toast.error('Could not update read status')
      }
    }
  }

  if (error && confessions.length === 0) {
    return <ErrorState retry={handleRefresh} message={error} />
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-10 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-90 disabled:opacity-50"
        >
          <RefreshCw size={20} className={`${refreshing ? 'animate-spin text-purple-600' : 'text-gray-500'}`} />
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        <AnimatePresence mode="popLayout">
          {confessions.length === 0 ? (
            <EmptyState />
          ) : (
            confessions.map((c) => (
              <motion.button
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                key={c.id}
                onClick={() => openMessage(c)}
                className="w-full text-left px-6 py-5 flex items-start gap-4 hover:bg-gray-50/50 transition-colors active:bg-gray-100 group"
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-all ${
                    c.is_read ? 'bg-gray-100 grayscale' : 'bg-gradient-to-tr from-purple-500 to-pink-500 shadow-purple-200'
                  }`}>
                    💌
                  </div>
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex justify-between items-baseline mb-1">
                    <p className={`text-xs tracking-wider uppercase font-bold ${c.is_read ? 'text-gray-400' : 'text-purple-600'}`}>
                      {c.is_read ? 'Read' : 'New'}
                    </p>
                  </div>
                  <p className={`text-base line-clamp-2 leading-relaxed ${c.is_read ? 'text-gray-500' : 'text-gray-900 font-medium'}`}>
                    {c.is_read ? c.message : "You have a new secret message..."}
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

function ErrorState({ retry, message }: { retry: () => void, message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
        <AlertCircle size={32} />
      </div>
      <h3 className="text-lg font-bold text-gray-900">Connection Error</h3>
      <p className="text-gray-500 mb-6 text-sm">{message}</p>
      <button 
        onClick={retry}
        className="bg-gray-900 text-white px-6 py-2 rounded-xl font-medium active:scale-95 transition-transform"
      >
        Try Again
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20 px-6">
      <div className="bg-purple-50 w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
        <MessageSquare className="w-10 h-10 text-purple-200" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Your inbox is quiet</h3>
      <p className="text-gray-500 mb-8 max-w-xs mx-auto text-sm">Share your profile link to start receiving anonymous messages.</p>
      <Link href="/dashboard" className="inline-block bg-purple-600 text-white px-8 py-3 rounded-2xl font-semibold shadow-lg shadow-purple-100">
        Get My Link
      </Link>
    </div>
  )
          }
             
