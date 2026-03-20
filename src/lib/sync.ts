// src/lib/sync.ts — Sync utilities for offline-first Dexie ↔ Supabase
import { db, type SyncQueueItem } from './db'
import { createClient } from './supabase/client'

// ─── Online Status Hook ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    )

    useEffect(() => {
        const goOnline = () => setIsOnline(true)
        const goOffline = () => setIsOnline(false)

        window.addEventListener('online', goOnline)
        window.addEventListener('offline', goOffline)

        return () => {
            window.removeEventListener('online', goOnline)
            window.removeEventListener('offline', goOffline)
        }
    }, [])

    return isOnline
}

// ─── Freshness Check ────────────────────────────────────────────────

const DEFAULT_MAX_AGE = 5 * 60 * 1000 // 5 minutes

export async function isStale(key: string, maxAgeMs: number = DEFAULT_MAX_AGE): Promise<boolean> {
    const meta = await db.meta.get(key)
    if (!meta) return true
    return Date.now() - meta.updated_at > maxAgeMs
}

export async function markFresh(key: string) {
    await db.meta.put({ key, value: true, updated_at: Date.now() })
}

// ─── Queue Offline Actions ──────────────────────────────────────────

export async function queueOfflineAction(
    table: string,
    action: SyncQueueItem['action'],
    payload: any
) {
    await db.syncQueue.add({
        table,
        action,
        payload,
        created_at: Date.now(),
        retries: 0,
    })
}

// ─── Flush Sync Queue ───────────────────────────────────────────────

export async function flushSyncQueue(): Promise<{ processed: number; failed: number }> {
    if (!navigator.onLine) return { processed: 0, failed: 0 }

    const supabase = createClient()
    const items = await db.syncQueue.orderBy('created_at').toArray()
    let processed = 0
    let failed = 0

    for (const item of items) {
        try {
            switch (item.action) {
                case 'insert': {
                    const { error } = await supabase.from(item.table).insert(item.payload)
                    if (error) throw error
                    break
                }
                case 'update': {
                    const { id, ...rest } = item.payload
                    const { error } = await supabase.from(item.table).update(rest).eq('id', id)
                    if (error) throw error
                    break
                }
                case 'rpc': {
                    const { fn, args } = item.payload
                    const { error } = await supabase.rpc(fn, args)
                    if (error) throw error
                    break
                }
                default:
                    break
            }
            // Success — remove from queue
            await db.syncQueue.delete(item.id!)
            processed++
        } catch (err) {
            console.error(`[Sync] Failed to process queue item ${item.id}:`, err)
            // Increment retries; drop after 5 attempts
            const retries = (item.retries || 0) + 1
            if (retries >= 5) {
                console.warn(`[Sync] Dropping queue item ${item.id} after ${retries} retries`)
                await db.syncQueue.delete(item.id!)
            } else {
                await db.syncQueue.update(item.id!, { retries })
            }
            failed++
        }
    }

    return { processed, failed }
}

// ─── Auto-flush on reconnect ────────────────────────────────────────

export function useAutoFlush() {
    const isOnline = useOnlineStatus()

    const flush = useCallback(async () => {
        if (isOnline) {
            const result = await flushSyncQueue()
            if (result.processed > 0) {
                console.log(`[Sync] Flushed ${result.processed} queued actions`)
            }
        }
    }, [isOnline])

    useEffect(() => {
        flush()
    }, [flush])

    return flush
}

// ─── Generic Sync Helper ────────────────────────────────────────────

/**
 * Fetch data from Supabase and cache it in the given Dexie table.
 * Returns the fetched data.
 */
export async function syncToLocal<T extends { id: string }>(
    tableName: string,
    query: () => Promise<{ data: T[] | null; error: any }>,
    dexieTable: { bulkPut: (items: any[]) => Promise<any> },
    metaKey: string
): Promise<T[]> {
    try {
        const { data, error } = await query()
        if (error) throw error
        if (data && data.length > 0) {
            const now = Date.now()
            const withTimestamp = data.map(item => ({ ...item, cached_at: now }))
            await dexieTable.bulkPut(withTimestamp)
        }
        await markFresh(metaKey)
        return data || []
    } catch (err) {
        console.error(`[Sync] Failed to sync ${tableName}:`, err)
        return []
    }
}

// ─── Cache Eviction ─────────────────────────────────────────────────

const DEFAULT_EVICT_AGE = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Evict stale entries from a Dexie table based on their `cached_at` timestamp.
 * Call periodically (e.g. on app start) to keep IndexedDB lean.
 */
export async function evictStaleCache(
    dexieTable: { where: (key: string) => any },
    maxAgeMs: number = DEFAULT_EVICT_AGE
): Promise<number> {
    try {
        const cutoff = Date.now() - maxAgeMs
        const deleted = await dexieTable
            .where('cached_at')
            .below(cutoff)
            .delete()
        if (deleted > 0) {
            console.log(`[Cache] Evicted ${deleted} stale entries`)
        }
        return deleted
    } catch (err) {
        console.error('[Cache] Eviction error:', err)
        return 0
    }
}

/**
 * Incremental sync — fetch only records updated after the last sync timestamp.
 * More efficient than full re-sync for tables with updated_at columns.
 */
export async function incrementalSync<T extends { id: string }>(
    tableName: string,
    supabaseQuery: (since: string) => Promise<{ data: T[] | null; error: any }>,
    dexieTable: { bulkPut: (items: any[]) => Promise<any> },
    metaKey: string
): Promise<T[]> {
    try {
        const meta = await db.meta.get(metaKey)
        const since = meta
            ? new Date(meta.updated_at).toISOString()
            : new Date(0).toISOString()

        const { data, error } = await supabaseQuery(since)
        if (error) throw error

        if (data && data.length > 0) {
            const now = Date.now()
            const withTimestamp = data.map(item => ({ ...item, cached_at: now }))
            await dexieTable.bulkPut(withTimestamp)
            console.log(`[Sync] Incrementally synced ${data.length} ${tableName} records`)
        }

        await markFresh(metaKey)
        return data || []
    } catch (err) {
        console.error(`[Sync] Incremental sync failed for ${tableName}:`, err)
        return []
    }
}
