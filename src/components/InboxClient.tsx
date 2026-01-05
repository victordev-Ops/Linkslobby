'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useNotifications } from '@/context/NotificationContext'

type Confession = {
  id: string
  message: string
  created_at: string
  is_read: boolean
}

export default function InboxClient({ 
  initialConfessions, 
  userId 
}: { 
  initialConfessions: Confession[]
  userId: string 
}) {
  const [confessions, setConfessions] = useState(initialConfessions)
  const [isLoading, setIsLoading] = useState(false)
  const { refreshUnreadCount } = useNotifications()
  const supabase = createClient()

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('inbox-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'confessions',
          filter: `profile_id=eq.${userId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setConfessions(prev => [payload.new as Confession, ...prev])
            refreshUnreadCount()
          } else if (payload.eventType === 'DELETE') {
            setConfessions(prev => prev.filter(c => c.id !== payload.old.id))
            refreshUnreadCount()
          } else if (payload.eventType === 'UPDATE') {
            setConfessions(prev => 
              prev.map(c => c.id === payload.new.id ? payload.new as Confession : c)
            )
            refreshUnreadCount()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, refreshUnreadCount])

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('confessions')
      .update({ is_read: true })
      .eq('id', id)

    if (error) {
      toast.error('Failed to mark as read')
      console.error(error)
    } else {
      setConfessions(prev => 
        prev.map(c => c.id === id ? { ...c, is_read: true } : c)
      )
      refreshUnreadCount()
    }
  }, [supabase, refreshUnreadCount])

  const deleteConfession = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('confessions')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete confession')
      console.error(error)
    } else {
      setConfessions(prev => prev.filter(c => c.id !== id))
      toast.success('Confession deleted')
      refreshUnreadCount()
    }
  }, [supabase, refreshUnreadCount])

  const loadMore = useCallback(async () => {
    if (isLoading || confessions.length < 50) return

    setIsLoading(true)
    const { data, error } = await supabase
      .from('confessions')
      .select('id, message, created_at, is_read')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .range(confessions.length, confessions.length + 49)

    if (error) {
      toast.error('Failed to load more')
      console.error(error)
    } else if (data) {
      setConfessions(prev => [...prev, ...data])
    }
    
    setIsLoading(false)
  }, [supabase, userId, confessions.length, isLoading])

  if (confessions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <MessageSquare size={64} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No confessions yet</h2>
        <p className="text-gray-500 text-center">
          When someone sends you a confession, it will appear here
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
        <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
        <div className="text-sm text-gray-500">
          {confessions.filter(c => !c.is_read).length} unread
        </div>
      </div>

      {/* Confessions List */}
      <div className="divide-y divide-gray-50">
        {confessions.map((confession) => (
          <div 
            key={confession.id} 
            className={`px-6 py-5 flex items-start gap-4 transition-colors ${
              !confession.is_read ? 'bg-purple-50/50' : 'bg-white'
            }`}
          >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              !confession.is_read ? 'bg-purple-100' : 'bg-gray-100'
            }`}>
              <MessageSquare 
                size={20} 
                className={!confession.is_read ? 'text-purple-600' : 'text-gray-400'} 
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-2">
                {!confession.is_read && (
                  <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                    New
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(confession.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              
              <p className="text-gray-900 leading-relaxed mb-3">
                {confession.message}
              </p>
              
              <div className="flex gap-2">
                {!confession.is_read && (
                  <button
                    onClick={() => markAsRead(confession.id)}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Mark as read
                  </button>
                )}
                <button
                  onClick={() => deleteConfession(confession.id)}
                  className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {confessions.length >= 50 && (
        <div className="px-6 py-8 flex justify-center">
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </>
  )
}
