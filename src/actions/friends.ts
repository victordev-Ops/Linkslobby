'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type FriendProfile = {
    id: string
    username: string
    avatar_url: string | null
    slug: string
}

export type FriendshipWithProfile = {
    id: string
    requester_id: string
    addressee_id: string
    status: string
    created_at: string
    profile: FriendProfile
}

export type ActionResult = {
    success: boolean
    error?: string
}

// ─── Send a friend request ───
export async function sendFriendRequest(targetUserId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (user.id === targetUserId) {
        return { success: false, error: 'You cannot add yourself' }
    }

    // Check if a friendship already exists in either direction
    const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`)
        .maybeSingle()

    if (existing) {
        if (existing.status === 'accepted') return { success: false, error: 'Already friends' }
        if (existing.status === 'pending') return { success: false, error: 'Request already pending' }
        // If declined, delete old one so they can send again
        await supabase.from('friendships').delete().eq('id', existing.id)
    }

    const { error } = await supabase.from('friendships').insert({
        requester_id: user.id,
        addressee_id: targetUserId,
        status: 'pending',
    })

    if (error) {
        console.error('Send friend request error:', error)
        return { success: false, error: 'Failed to send request' }
    }

    return { success: true }
}

// ─── Accept a friend request ───
export async function acceptFriendRequest(friendshipId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId)
        .eq('addressee_id', user.id)
        .eq('status', 'pending')

    if (error) {
        console.error('Accept friend request error:', error)
        return { success: false, error: 'Failed to accept request' }
    }

    return { success: true }
}

// ─── Decline a friend request ───
export async function declineFriendRequest(friendshipId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .eq('addressee_id', user.id)

    if (error) {
        console.error('Decline friend request error:', error)
        return { success: false, error: 'Failed to decline request' }
    }

    return { success: true }
}

// ─── Remove a friend ───
export async function removeFriend(friendshipId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Security: only allow deleting friendships the user is part of
    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    if (error) {
        console.error('Remove friend error:', error)
        return { success: false, error: 'Failed to remove friend' }
    }

    return { success: true }
}

// ─── Block a user (also removes any existing friendship between the two) ───
export async function blockUser(targetUserId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (user.id === targetUserId) {
        return { success: false, error: 'You cannot block yourself' }
    }

    // Clear out any friendship (pending or accepted) between the two users first
    await supabase
        .from('friendships')
        .delete()
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`)

    const { error } = await supabase
        .from('blocked_users')
        .upsert({ blocker_id: user.id, blocked_id: targetUserId }, { onConflict: 'blocker_id,blocked_id' })

    if (error) {
        console.error('Block user error:', error)
        return { success: false, error: 'Failed to block user' }
    }

    return { success: true }
}

// ─── Unblock a user ───
export async function unblockUser(targetUserId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId)

    if (error) {
        console.error('Unblock user error:', error)
        return { success: false, error: 'Failed to unblock user' }
    }

    return { success: true }
}

// ─── Get accepted friends ───
export async function getFriends(): Promise<FriendshipWithProfile[]> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Get friendships where I'm either the requester or addressee
    const { data, error } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .order('updated_at', { ascending: false })

    if (error || !data) return []

    // Fetch all friend profile IDs
    const friendIds = data.map(f =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
    )

    if (friendIds.length === 0) return []

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, slug')
        .in('id', friendIds)

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    return data.map(f => {
        const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id
        return {
            ...f,
            profile: profileMap.get(friendId) || { id: friendId, username: 'Unknown', avatar_url: null, slug: '' },
        }
    })
}

// ─── Get friendship status between the current viewer and another user ───
export type FriendshipStatusResult = {
    status: 'none' | 'pending_sent' | 'pending_received' | 'accepted'
    friendshipId?: string
}

export async function getFriendshipStatus(otherUserId: string): Promise<FriendshipStatusResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id === otherUserId) return { status: 'none' }

    const { data } = await supabase
        .from('friendships')
        .select('id, requester_id, status')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`)
        .maybeSingle()

    if (!data) return { status: 'none' }

    if (data.status === 'accepted') return { status: 'accepted', friendshipId: data.id }

    if (data.status === 'pending') {
        return {
            status: data.requester_id === user.id ? 'pending_sent' : 'pending_received',
            friendshipId: data.id,
        }
    }

    return { status: 'none' }
}

// ─── Get pending incoming requests ───
export async function getPendingRequests(): Promise<FriendshipWithProfile[]> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at')
        .eq('addressee_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (error || !data) return []

    const requesterIds = data.map(f => f.requester_id)
    if (requesterIds.length === 0) return []

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, slug')
        .in('id', requesterIds)

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    return data.map(f => ({
        ...f,
        profile: profileMap.get(f.requester_id) || { id: f.requester_id, username: 'Unknown', avatar_url: null, slug: '' },
    }))
}

// ─── Get sent pending requests ───
export async function getSentRequests(): Promise<FriendshipWithProfile[]> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at')
        .eq('requester_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (error || !data) return []

    const addresseeIds = data.map(f => f.addressee_id)
    if (addresseeIds.length === 0) return []

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, slug')
        .in('id', addresseeIds)

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    return data.map(f => ({
        ...f,
        profile: profileMap.get(f.addressee_id) || { id: f.addressee_id, username: 'Unknown', avatar_url: null, slug: '' },
    }))
}

// ─── Get suggested friends (people you may know) ───
export async function getSuggestedFriends(limit = 10): Promise<FriendProfile[]> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Get all user IDs that are already connected (any friendship status)
    const { data: existingFriendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const connectedIds = new Set<string>([user.id])
    if (existingFriendships) {
        for (const f of existingFriendships) {
            connectedIds.add(f.requester_id)
            connectedIds.add(f.addressee_id)
        }
    }

    // Get blocked user IDs
    const { data: blockedData } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id)

    if (blockedData) {
        for (const b of blockedData) connectedIds.add(b.blocked_id)
    }

    // Get suggested profiles — exclude connected/blocked users, require username to be set
    const excludeIds = Array.from(connectedIds)
    const { data: suggestions, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, slug')
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .not('username', 'is', null)
        .neq('username', '')
        .limit(limit)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Suggested friends error:', error)
        return []
    }

    return suggestions || []
}

// ─── Send a game invite notification to a friend ───
export async function sendGameInvite(
    friendUserId: string,
    gameType: 'tod' | 'hot_seat',
    gameUrl: string,
    gameName?: string
): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
        const gameLabel = gameType === 'tod' ? 'Truth or Dare' : 'Hot Seat'
        const label = gameName ? `"${gameName}"` : gameLabel

        const { error } = await supabase.from('game_invites').insert({
            inviter_id: user.id,
            invitee_id: friendUserId,
            game_type: gameType,
            game_label: label,
            game_url: gameUrl,
            is_read: false,
        })

        // RLS on game_invites requires an accepted friendship between inviter and
        // invitee — if the insert is rejected, surface that instead of pretending
        // it worked (the old xp_transactions version silently swallowed this).
        if (error) {
            console.error('Game invite insert error:', error)
            return { success: false, error: 'Failed to send invite' }
        }

        return { success: true }
    } catch (err) {
        console.error('Game invite error:', err)
        return { success: false, error: 'Failed to send invite' }
    }
}

// ─── Search for users to add as friends (e.g. from a lobby waiting room) ───
export type FriendSearchResult = FriendProfile & {
    friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted'
}

export async function searchUsers(query: string, limit = 10): Promise<FriendSearchResult[]> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const trimmed = query.trim()
    if (trimmed.length < 2) return []

    // Escape % and _ so they aren't treated as ILIKE wildcards
    const escaped = trimmed.replace(/[%_]/g, (m) => `\\${m}`)

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, slug')
        .ilike('username', `%${escaped}%`)
        .neq('id', user.id)
        .not('username', 'is', null)
        .neq('username', '')
        .limit(limit)

    if (error || !profiles || profiles.length === 0) return []

    // Exclude blocked users (either direction)
    const { data: blockedData } = await supabase
        .from('blocked_users')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)

    const blockedIds = new Set<string>()
    for (const b of blockedData || []) {
        if (b.blocker_id === user.id) blockedIds.add(b.blocked_id)
        if (b.blocked_id === user.id) blockedIds.add(b.blocker_id)
    }

    const visible = profiles.filter(p => !blockedIds.has(p.id))
    if (visible.length === 0) return []

    // Attach friendship status for each result so the UI can show the right button
    const ids = visible.map(p => p.id)
    const { data: friendships } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const statusMap = new Map<string, FriendSearchResult['friendshipStatus']>()
    for (const f of friendships || []) {
        const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id
        if (!ids.includes(otherId)) continue
        if (f.status === 'accepted') statusMap.set(otherId, 'accepted')
        else if (f.status === 'pending') {
            statusMap.set(otherId, f.requester_id === user.id ? 'pending_sent' : 'pending_received')
        }
    }

    return visible.map(p => ({
        ...p,
        friendshipStatus: statusMap.get(p.id) || 'none',
    }))
}

