'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

const GLOBAL_PRESENCE_CHANNEL = 'presence:global'

interface PresenceContextValue {
    onlineUserIds: Set<string>
    isOnline: (userId: string) => boolean
}

const PresenceContext = createContext<PresenceContextValue>({
    onlineUserIds: new Set(),
    isOnline: () => false,
})

export function usePresence() {
    return useContext(PresenceContext)
}

/**
 * Mount ONCE at the app root (e.g. in the root layout, alongside
 * NotificationProvider) — not per-page and not per-conversation. A single
 * channel subscription tracks the current user as "online" for as long as
 * they have any tab open anywhere in the app, and every other mounted
 * client sees them in presence state regardless of what page they're on.
 *
 * Previously each DM thread opened its OWN presence channel scoped to that
 * session, so a user only showed "online" to someone if that specific
 * thread happened to be open on both ends at the same time — not what
 * "online" should mean for an app-wide status indicator.
 */
export function PresenceProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
    const supabase = useRef(createClient()).current
    const channelRef = useRef<RealtimeChannel | null>(null)

    useEffect(() => {
        if (!userId) return

        const channel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
            config: { presence: { key: userId } },
        })
        channelRef.current = channel

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState()
                setOnlineUserIds(new Set(Object.keys(state)))
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: userId, online_at: new Date().toISOString() })
                }
            })

        // Heartbeat a persisted last_active_at while online anywhere in the
        // app — this is what powers the "Offline · Xm ago" fallback label
        // for OTHER users when they open a chat with someone who isn't
        // currently online. Runs app-wide now instead of only while a
        // specific DM thread happened to be open.
        const heartbeat = () => {
            supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', userId).then(() => {}, () => {})
        }
        heartbeat()
        const heartbeatInterval = setInterval(heartbeat, 45000)

        // Re-assert presence when the tab regains focus/visibility — mobile
        // Safari/Chrome can silently drop the realtime socket in background
        // tabs, so this keeps "online" from getting stuck stale after
        // switching apps and coming back.
        const onVisible = () => {
            if (document.visibilityState === 'visible' && channelRef.current) {
                channelRef.current.track({ user_id: userId, online_at: new Date().toISOString() }).catch(() => {})
            }
        }
        document.addEventListener('visibilitychange', onVisible)

        return () => {
            document.removeEventListener('visibilitychange', onVisible)
            clearInterval(heartbeatInterval)
            heartbeat()
            supabase.removeChannel(channel)
            channelRef.current = null
        }
    }, [userId, supabase])

    return (
        <PresenceContext.Provider
            value={{
                onlineUserIds,
                isOnline: (id: string) => onlineUserIds.has(id),
            }}
        >
            {children}
        </PresenceContext.Provider>
    )
}
