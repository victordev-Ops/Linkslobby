'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { XP_PENALTIES } from '@/hooks/xp'

export async function penalizeSkippedRound(lobbyId: string) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Verify verify host and get current state
        const { data: lobby } = await supabase
            .from('tod_lobbies')
            .select('host_id, current_target_id, current_question')
            .eq('id', lobbyId)
            .single()

        if (!lobby || lobby.host_id !== user.id) {
            console.error('Unauthorized penalty attempt')
            return
        }

        // Only penalize if there was an active question (skipped round)
        if (lobby.current_question && lobby.current_target_id) {
            // 3. Deduct XP from target (Requires Admin/Service Role)
            // We use the service role key to bypass RLS since Host cannot spend Target's XP
            const adminClient = require('@supabase/supabase-js').createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                }
            )

            await adminClient.rpc('spend_xp', {
                p_user_id: lobby.current_target_id,
                p_amount: XP_PENALTIES.SKIP_ROUND_NO_ANSWER,
                p_reason: 'Skipped Round Penalty',
                p_metadata: { lobby_id: lobbyId, role: 'target' }
            })
        }
    } catch (error) {
        console.error('Penalize skip error:', error)
    }
}

export async function penalizeSystemModeSelection(lobbyId: string) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: lobby } = await supabase
            .from('tod_lobbies')
            .select('host_id, current_target_id')
            .eq('id', lobbyId)
            .single()

        if (!lobby || lobby.host_id !== user.id) return

        if (lobby.current_target_id) {
            const adminClient = require('@supabase/supabase-js').createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                }
            )

            await adminClient.rpc('spend_xp', {
                p_user_id: lobby.current_target_id,
                p_amount: XP_PENALTIES.SYSTEM_CHOSE_MODE,
                p_reason: 'System Mode Selection Penalty',
                p_metadata: { lobby_id: lobbyId }
            })
        }
    } catch (error) {
        console.error('Penalize system mode error:', error)
    }
}

// ─── Create a lobby (host only, enforces free/pro limit server-side) ───
// Limit is also enforced by a DB trigger (tod_enforce_lobby_limit) so this
// stays correct even if two create requests race — the trigger is the
// source of truth, this is just a friendlier error path.
const FREE_LOBBY_LIMIT = 1
const PRO_LOBBY_LIMIT = 3

function slugify(text: string) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
}

export async function createLobbyAction(name: string, category: string) {
    const supabase = await createSupabaseServerClient()

    try {
        console.log('Supabase env check:', {
            hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        })

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, message: 'Not authenticated' }

        if (!name?.trim()) {
            return { success: false, message: 'Please enter a lobby name' }
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_pro')
            .eq('id', user.id)
            .single()

        const isPro = profile?.is_pro ?? false
        const maxLobbies = isPro ? PRO_LOBBY_LIMIT : FREE_LOBBY_LIMIT

        const { data: existingLobbies, error: countError } = await supabase
            .from('tod_lobbies')
            .select('id')
            .eq('host_id', user.id)

        if (countError) {
            console.error('Lobby count check error (raw):', countError)
            console.error('Lobby count check error (name/stack):', {
                name: (countError as any)?.name,
                constructor: (countError as any)?.constructor?.name,
                stack: (countError as any)?.stack,
                keys: Object.keys(countError as any),
            })
            throw countError
        }

        const count = existingLobbies?.length ?? 0

        if ((count ?? 0) >= maxLobbies) {
            return { success: false, limitReached: true, message: `You've reached your limit of ${maxLobbies} lobby${maxLobbies > 1 ? 'ies' : ''}.` }
        }

        const { data: lobby, error: lobbyError } = await supabase
            .from('tod_lobbies')
            .insert({
                host_id: user.id,
                status: 'waiting',
                name: name.trim(),
                slug: `${slugify(name)}-${Math.random().toString(36).substring(2, 6)}`,
                category,
            })
            .select()
            .single()

        if (lobbyError) throw lobbyError

        const { error: joinError } = await supabase
            .from('tod_participants')
            .insert({
                lobby_id: lobby.id,
                user_id: user.id,
                status: 'joined'
            })

        if (joinError) throw joinError

        return { success: true, lobby }
    } catch (error: any) {
        console.error('Create lobby error:', {
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            code: error?.code,
        })
        const readable = error?.message || error?.details || error?.hint || 'Failed to create lobby'
        return { success: false, message: readable }
    }
}

// ─── Join a lobby (via shared link). No more private/public split — the
// only gate is whether the host has banned this user. ───
export async function joinLobbyAction(lobbyId: string) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("User not authenticated")

        // 0. Check if user is blocked by the lobby host
        const { data: lobbyCheck } = await supabase
            .from('tod_lobbies')
            .select('host_id')
            .eq('id', lobbyId)
            .single()

        if (lobbyCheck) {
            const { isUserBlocked } = await import('@/actions/blocked-users')
            const blocked = await isUserBlocked(lobbyCheck.host_id, user.id)
            if (blocked) {
                return { success: false, message: 'You cannot join this lobby.' }
            }
        }

        // 1. Check if already joined / banned
        const { data: existing } = await supabase
            .from('tod_participants')
            .select('status')
            .eq('lobby_id', lobbyId)
            .eq('user_id', user.id)
            .maybeSingle()

        if (existing) {
            if (existing.status === 'banned') {
                return { success: false, status: 'banned', message: 'You have been banned from this lobby 🚫' }
            }
            return { success: true, status: existing.status, message: 'Already joined' }
        }

        // 2. Insert participant — always joins directly now
        const { error: joinError } = await supabase
            .from('tod_participants')
            .insert({
                lobby_id: lobbyId,
                user_id: user.id,
                status: 'joined'
            })

        if (joinError) throw joinError

        // 3. Award XP to host for a new player joining
        if (lobbyCheck?.host_id) {
            const adminClient = require('@supabase/supabase-js').createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                }
            )

            const { data: hostProfile } = await adminClient
                .from('profiles')
                .select('is_pro')
                .eq('id', lobbyCheck.host_id)
                .single()

            const hostIsPro = hostProfile?.is_pro ?? false
            const rewardAmount = 5 // XP_REWARDS.TOD_PARTICIPANT_JOINED
            const finalAmount = hostIsPro ? rewardAmount * 2 : rewardAmount
            const reason = hostIsPro ? 'Player joined your lobby (2x Pro Bonus)' : 'Player joined your lobby'

            await adminClient.rpc('add_xp', {
                p_user_id: lobbyCheck.host_id,
                p_amount: finalAmount,
                p_reason: reason,
                p_metadata: { lobby_id: lobbyId, joined_user_id: user.id }
            })
        }

        return { success: true, status: 'joined' }

    } catch (error: any) {
        console.error('Join lobby error:', error)
        return { success: false, message: error.message }
    }
}

// ─── Delete a lobby (owner only) ───
export async function deleteLobbyAction(lobbyId: string) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, message: 'Not authenticated' }

        const { data, error } = await supabase.rpc('delete_tod_lobby', {
            p_lobby_id: lobbyId,
        })

        if (error) throw error
        if (!data?.success) {
            return { success: false, message: data?.error || 'Failed to delete lobby' }
        }

        return { success: true }
    } catch (error: any) {
        console.error('Delete lobby error:', error)
        return { success: false, message: error.message || 'Failed to delete lobby' }
    }
}

// ─── Get user's own lobbies (for limit management) ───
export async function getUserLobbies() {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const { data, error } = await supabase
            .from('tod_lobbies')
            .select('id, name, slug, category, status, created_at')
            .eq('host_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Get user lobbies error:', error)
        return []
    }
            }
        
