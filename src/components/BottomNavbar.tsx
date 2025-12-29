'use client'

import { useState, useEffect } from 'react'
import { Home, Inbox, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNavbar({ profileId }: { profileId: string }) {
  const pathname = usePathname()
  const supabase = createClient()
  
  // FIX: Use state so the UI updates when a new message arrives
  const [unreadCount, setUnreadCount] = useState(0)

  // 1. Fetch Initial Count
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

  // 2. Real-time Listener ONLY
  useEffect(() => {
    if (!profileId) return

    const channel = supabase
      .channel(`navbar-unread-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERTs (count up) and UPDATEs (count down)
          schema: 'public',
          table: 'confessions',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          // If a new message comes in, increment
          if (payload.eventType === 'INSERT') {
            setUnreadCount(prev => prev + 1)
          } 
          // If a message is marked as read, decrement
          if (payload.eventType === 'UPDATE' && payload.new.is_read === true && payload.old.is_read === false) {
            setUnreadCount(prev => Math.max(0, prev - 1))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profileId, supabase])

  const isHomeActive = pathname === '/dashboard'
  const isInboxActive = pathname.startsWith('/inbox') // Catch /inbox and /inbox/[id]
  const isSettingsActive = pathname === '/settings'

  // ... rest of your Tailwind JSX (keep the styles and Link components)
