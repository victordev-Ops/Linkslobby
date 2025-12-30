// src/components/BottomNavbar.tsx
'use client'

import { useNotifications } from '@context/NotificationContext'
import { useState, useEffect } from 'react'
import { Home, Inbox, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNavbar({ profileId }: { profileId: string }) {
  const {unreadCount} = useNotifications()
  const pathname = usePathname()
  const supabase = createClient()
  
  
  // 1. Fetch Initial Unread Count
  useEffect(() => {
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('confessions')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('is_read', false)

      setUnreadCount(count || 0)
    }

    if (profileId) fetchUnread()
  }, [profileId, supabase])

  // 2. Real-time Listener for Badge Updates
  useEffect(() => {
    if (!profileId) return

    const channel = supabase
      .channel(`navbar-unread-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT (new message) and UPDATE (marked read)
          schema: 'public',
          table: 'confessions',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setUnreadCount((prev) => prev + 1)
          } else if (payload.eventType === 'UPDATE') {
            // If a message was marked as read, decrement the badge
            if (payload.new.is_read === true && payload.old.is_read === false) {
              setUnreadCount((prev) => Math.max(0, prev - 1))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profileId, supabase])

  const isHomeActive = pathname === '/dashboard'
  const isInboxActive = pathname.startsWith('/inbox')
  const isSettingsActive = pathname === '/settings'

  const tabClass = (isActive: boolean) =>
    `group relative flex flex-col items-center gap-1 p-4 rounded-2xl transition-all duration-200 ${
      isActive ? 'text-purple-600' : 'text-gray-500 hover:text-purple-600'
    }`

  const iconClass = "group-active:scale-90 transition-transform"

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 px-4 py-3 z-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-around items-center">
          {/* Home */}
          <Link href="/dashboard" className={tabClass(isHomeActive)}>
            <Home size={26} strokeWidth={2.5} className={iconClass} />
            <span className="text-xs font-medium">Home</span>
            {isHomeActive && (
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-purple-600 rounded-full" />
            )}
          </Link>

          {/* Inbox */}
          <Link href="/inbox" className={tabClass(isInboxActive)}>
            <div className="relative">
              <Inbox size={26} strokeWidth={2.5} className={iconClass} />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white shadow-lg">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">Inbox</span>
            {isInboxActive && (
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-purple-600 rounded-full" />
            )}
          </Link>

          {/* Settings */}
          <Link href="/settings" className={tabClass(isSettingsActive)}>
            <Settings size={26} strokeWidth={2.5} className={iconClass} />
            <span className="text-xs font-medium">Settings</span>
            {isSettingsActive && (
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-purple-600 rounded-full" />
            )}
          </Link>
        </div>
      </div>
    </div>
  )
            }
          
