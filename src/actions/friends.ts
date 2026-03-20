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

    // Notify the addressee of the incoming friend request
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single()

        const username = profile?.username || 'Someone'

        await supabase.from('xp_transactions').insert({
            user_id: targetUserId,
            amount: 0,
            type: 'earn',
            reason: `👋 You received a friend request from @${username}`,
            is_read: false,
        })
    } catch (notifErr) {
        console.error('Friend request notification error:', notifErr)
        // Non-critical — don't fail the request
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

    // Notify the requester that their request was accepted
    try {
        // Fetch the friendship to get requester_id
        const { data: friendship } = await supabase
            .from('friendships')
            .select('requester_id')
            .eq('id', friendshipId)
            .single()

        if (friendship) {
            // Get current user's username for the notification message
            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', user.id)
                .single()

            const username = profile?.username || 'Someone'

            await supabase.from('xp_transactions').insert({
                user_id: friendship.requester_id,
                amount: 0,
                type: 'earn',
                reason: `🤝 @${username} accepted your friend request!`,
                is_read: false,
            })
        }
    } catch (notifErr) {
        console.error('Friend accept notification error:', notifErr)
        // Non-critical — don't fail the accept
    }

    return { success: true }
}

// ─── Decline a friend request ───
export async function declineFriendRequest(friendshipId: string): Promise<ActionResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Fetch the friendship to get the requester_id before deleting
    const { data: friendship } = await supabase
        .from('friendships')
        .select('requester_id')
        .eq('id', friendshipId)
        .eq('addressee_id', user.id)
        .single()

    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .eq('addressee_id', user.id)

    if (error) {
        console.error('Decline friend request error:', error)
        return { success: false, error: 'Failed to decline request' }
    }

    // Notify the requester that their request was declined
    if (friendship) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', user.id)
                .single()

            const username = profile?.username || 'Someone'

            await supabase.from('xp_transactions').insert({
                user_id: friendship.requester_id,
                amount: 0,
                type: 'earn',
                reason: `😔 @${username} declined your friend request`,
                is_read: false,
            })
        } catch (notifErr) {
            console.error('Friend decline notification error:', notifErr)
        }
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
