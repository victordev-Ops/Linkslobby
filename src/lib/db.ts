// src/lib/db.ts — Dexie IndexedDB database for offline-first caching
import Dexie, { type EntityTable } from 'dexie'

// ─── Table Interfaces ───────────────────────────────────────────────

export interface CachedProfile {
    id: string
    username: string | null
    slug: string | null
    is_pro?: boolean
    xp_balance?: number
    cached_at: number
}

export interface CachedConfession {
    id: string
    profile_id: string
    message: string
    created_at: string
    is_read: boolean
    message_type: 'confession' | 'ama' | 'anonymous' | 'direct_message'
    cached_at: number
}

export interface CachedMessage {
    id: string
    conversation_key: string // "{selfId}:{targetId}" sorted
    content: string
    sender_id: string
    created_at: string
    is_own: boolean
    is_read?: boolean
    is_optimistic?: boolean
    cached_at: number
}

export interface CachedChatSession {
    id: string
    updated_at: string
    last_message_preview?: string
    other_user?: {
        id: string
        username: string | null
    }
    unread_count?: number
    cached_at: number
}

export interface CachedChatMessage {
    id: string
    session_id: string
    sender_id: string
    content: string
    created_at: string
    is_system?: boolean
    metadata?: any
    cached_at: number
}

export interface CachedTodLobby {
    id: string
    host_id: string
    name?: string
    slug?: string
    category?: string
    is_private?: boolean
    status: 'waiting' | 'active' | 'finished'
    created_at: string
    host_username?: string
    participant_count?: number
    is_participant?: boolean
    user_status?: string
    cached_at: number
}

export interface CachedHotSeatSession {
    id: string
    host_id: string
    slug: string
    name: string
    status: string
    is_private: boolean
    created_at: string
    host_username?: string
    host_slug?: string
    participant_count?: number
    cached_at: number
}

export interface CachedXPTransaction {
    id: string
    user_id: string
    amount: number
    type: 'earn' | 'spend'
    reason: string
    metadata?: any
    created_at: string
    cached_at: number
}

export interface CachedNotification {
    id: string
    type: 'confession' | 'dykm_score' | 'lobby_event' | 'xp_transaction' | 'hot_seat_question'
    data: any
    created_at: string
    is_hidden: boolean
    cached_at: number
}

export interface SyncQueueItem {
    id?: number // auto-increment
    table: string
    action: 'insert' | 'update' | 'delete' | 'rpc'
    payload: any
    created_at: number
    retries: number
}

export interface SyncMeta {
    key: string
    value: any
    updated_at: number
}

// ─── Database Definition ────────────────────────────────────────────

class SayAppDB extends Dexie {
    profiles!: EntityTable<CachedProfile, 'id'>
    confessions!: EntityTable<CachedConfession, 'id'>
    messages!: EntityTable<CachedMessage, 'id'>
    todLobbies!: EntityTable<CachedTodLobby, 'id'>
    hotSeatSessions!: EntityTable<CachedHotSeatSession, 'id'>
    xpTransactions!: EntityTable<CachedXPTransaction, 'id'>
    notifications!: EntityTable<CachedNotification, 'id'>
    syncQueue!: EntityTable<SyncQueueItem, 'id'>
    meta!: EntityTable<SyncMeta, 'key'>
    chatSessions!: EntityTable<CachedChatSession, 'id'>
    chatMessages!: EntityTable<CachedChatMessage, 'id'>

    constructor() {
        super('SayAppDB')

        this.version(4).stores({
            profiles: 'id, username, slug',
            confessions: 'id, profile_id, created_at, is_read, is_hidden, message_type',
            messages: 'id, conversation_key, created_at', // Legacy
            todLobbies: 'id, host_id, status, created_at',
            hotSeatSessions: 'id, host_id, status, created_at',
            xpTransactions: 'id, user_id, created_at',
            notifications: 'id, type, created_at, is_hidden',
            syncQueue: '++id, table, action, created_at',
            meta: 'key',

            chatSessions: 'id, updated_at',
            chatMessages: 'id, session_id, created_at'
        }).upgrade(tx => {
            // Migration logic if needed
        })
    }
}

// Singleton instance
export const db = new SayAppDB()

// ─── Helper: Clear all user data (on sign out) ─────────────────────

export async function clearAllCachedData() {
    await Promise.all([
        db.profiles.clear(),
        db.confessions.clear(),
        db.messages.clear(),
        db.todLobbies.clear(),
        db.hotSeatSessions.clear(),
        db.xpTransactions.clear(),
        db.notifications.clear(),
        db.syncQueue.clear(),
        db.meta.clear(),
        db.chatSessions.clear(),
        db.chatMessages.clear(),
    ])
}

// ─── Helper: Build conversation key (for DMs) ──────────────────────

export function buildConversationKey(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join(':')
}
