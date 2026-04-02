// src/actions/rps.ts — Server actions for the RPS game system (V2)
// All XP mutations happen inside atomic Supabase RPCs.
// V2 changes: idempotent submissions, AI takeover, round audit, match history.
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

// ─── Types ──────────────────────────────────────────────────────────

export type RPSMode = 'solo' | 'friend'
export type RPSMove = 'rock' | 'paper' | 'scissors'
export type RPSStatus = 'waiting' | 'active' | 'completed' | 'cancelled' | 'timeout'

export type RPSMatch = {
    id: string
    player_a: string
    player_b: string | null
    mode: RPSMode
    stake_amount: number
    best_of: number
    room_code: string | null
    score_a: number
    score_b: number
    current_round: number
    move_a: RPSMove | null
    move_b: RPSMove | null
    last_move_a: RPSMove | null
    last_move_b: RPSMove | null
    last_round_result: string | null
    escrow_a: boolean
    escrow_b: boolean
    status: RPSStatus
    winner_id: string | null
    ai_player: 'a' | 'b' | null
    round_version: number
    move_deadline_at: string | null
    // ─── Disconnect tracking ───
    disconnected_player: string | null
    disconnected_at: string | null
    disconnect_count_a: number
    disconnect_count_b: number
    // ─── Timestamps ───
    created_at: string
    updated_at: string
    round_started_at: string | null
    completed_at: string | null
}

export type RPSRound = {
    id: string
    match_id: string
    round_number: number
    move_a: RPSMove
    move_b: RPSMove
    result: 'a_wins' | 'b_wins' | 'tie'
    ai_played: boolean
    resolved_at: string
}

export type RPSMatchHistoryItem = {
    match_id: string
    mode: RPSMode
    stake_amount: number
    score_a: number
    score_b: number
    status: RPSStatus
    winner_id: string | null
    ai_player: 'a' | 'b' | null
    completed_at: string | null
    my_side: 'a' | 'b'
    outcome: 'won' | 'lost' | 'cancelled'
    xp_change: number
    opponent_name: string
    opponent_avatar: string | null
}

export type RPSActionResult = {
    success: boolean
    error?: string
    match_id?: string
    stake?: number
    room_code?: string
    new_balance?: number
    // Round resolution fields
    status?: string
    round_result?: 'a_wins' | 'b_wins' | 'tie'
    move_a?: RPSMove
    move_b?: RPSMove
    score_a?: number
    score_b?: number
    winner_id?: string | null
    current_round?: number
    your_move?: RPSMove
    action?: string
    current_balance?: number
    required?: number
    remaining_player_id?: string
    // V2 additions
    round_version?: number
    ai_played?: boolean
    ai_side?: 'a' | 'b'
    current_round_version?: number
}

// ─── Create a new match ─────────────────────────────────────────────

export async function createRPSMatch(
    mode: RPSMode,
    stake: number = 100,
    roomCode?: string
): Promise<RPSActionResult> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data, error } = await supabase.rpc('rps_create_match_v2', {
            p_mode: mode,
            p_stake: stake,
            p_room_code: roomCode || null,
        })
        if (error) {
            console.error('createRPSMatch RPC error:', error)
            return { success: false, error: error.message }
        }
        return data as RPSActionResult
    } catch (err: any) {
        console.error('createRPSMatch error:', err)
        return { success: false, error: err.message || 'Failed to create match' }
    }
}

// ─── Join an existing match by room code ────────────────────────────

export async function joinRPSMatch(roomCode: string): Promise<RPSActionResult> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data, error } = await supabase.rpc('rps_join_match_v2', {
            p_room_code: roomCode.trim().toUpperCase(),
        })
        if (error) {
            console.error('joinRPSMatch RPC error:', error)
            return { success: false, error: error.message }
        }
        return data as RPSActionResult
    } catch (err: any) {
        console.error('joinRPSMatch error:', err)
        return { success: false, error: err.message || 'Failed to join match' }
    }
}

// ─── Submit a move (with idempotency via round_version) ─────────────

export async function submitRPSMove(
    matchId: string,
    move: RPSMove,
    roundVersion: number = -1
): Promise<RPSActionResult> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data, error } = await supabase.rpc('rps_submit_move_v2', {
            p_match_id: matchId,
            p_move: move,
            p_round_version: roundVersion,
        })
        if (error) {
            console.error('submitRPSMove RPC error:', error)
            return { success: false, error: error.message }
        }
        return data as RPSActionResult
    } catch (err: any) {
        console.error('submitRPSMove error:', err)
        return { success: false, error: err.message || 'Failed to submit move' }
    }
}

// ─── Cancel / forfeit a match ───────────────────────────────────────

export async function cancelRPSMatch(matchId: string): Promise<RPSActionResult> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data, error } = await supabase.rpc('rps_cancel_match_v2', {
            p_match_id: matchId,
        })
        if (error) {
            console.error('cancelRPSMatch RPC error:', error)
            return { success: false, error: error.message }
        }
        return data as RPSActionResult
    } catch (err: any) {
        console.error('cancelRPSMatch error:', err)
        return { success: false, error: err.message || 'Failed to cancel match' }
    }
}

// ─── Trigger AI Takeover (replaces handleOpponentDisconnect) ────────

export async function triggerAITakeover(
    matchId: string,
    disconnectedUserId: string
): Promise<RPSActionResult> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Not authenticated' }

        const { data, error } = await supabase.rpc('rps_ai_takeover', {
            p_match_id: matchId,
            p_disconnected_user_id: disconnectedUserId,
        })
        if (error) {
            console.error('triggerAITakeover RPC error:', error)
            return { success: false, error: error.message }
        }
        return data as RPSActionResult
    } catch (err: any) {
        console.error('triggerAITakeover error:', err)
        return { success: false, error: err.message || 'Failed to trigger AI takeover' }
    }
}

// ─── Reconnect to match after disconnect ─────────────────────────
// Called when a disconnected player returns. Clears disconnect state
// and hands back control (after AI finishes any in-progress round).

export async function reconnectToMatch(matchId: string): Promise<RPSActionResult> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Not authenticated' }

        const { data, error } = await supabase.rpc('rps_player_reconnect', {
            p_match_id: matchId,
        })
        if (error) {
            console.error('reconnectToMatch RPC error:', error)
            return { success: false, error: error.message }
        }
        return data as RPSActionResult
    } catch (err: any) {
        console.error('reconnectToMatch error:', err)
        return { success: false, error: err.message || 'Failed to reconnect' }
    }
}

// ─── Get the user's current active match (for reconnection) ─────────

export async function getActiveRPSMatch(): Promise<{
    success: boolean
    match: RPSMatch | null
    error?: string
}> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, match: null, error: 'Not authenticated' }

        const { data, error } = await supabase
            .from('rps_matches')
            .select('*')
            .or(`player_a.eq.${user.id},player_b.eq.${user.id}`)
            .in('status', ['waiting', 'active'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('getActiveRPSMatch error:', error)
            return { success: false, match: null, error: error.message }
        }

        return { success: true, match: data as RPSMatch | null }
    } catch (err: any) {
        return { success: false, match: null, error: err.message }
    }
}

// ─── Get a specific match state ─────────────────────────────────────

export async function getRPSMatch(matchId: string): Promise<{
    success: boolean
    match: RPSMatch | null
    error?: string
}> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data, error } = await supabase
            .from('rps_matches')
            .select('*')
            .eq('id', matchId)
            .single()

        if (error) {
            console.error('getRPSMatch error:', error)
            return { success: false, match: null, error: error.message }
        }

        return { success: true, match: data as RPSMatch }
    } catch (err: any) {
        return { success: false, match: null, error: err.message }
    }
}

// ─── Get the user's XP balance ──────────────────────────────────────

export async function getRPSBalance(): Promise<{
    success: boolean
    balance: number
    error?: string
}> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, balance: 0, error: 'Not authenticated' }

        const { data, error } = await supabase
            .from('profiles')
            .select('xp_balance')
            .eq('id', user.id)
            .single()

        if (error) {
            return { success: false, balance: 0, error: error.message }
        }

        return { success: true, balance: data?.xp_balance || 0 }
    } catch (err: any) {
        return { success: false, balance: 0, error: err.message }
    }
}

// ─── Get round-by-round audit trail for a match ─────────────────────

export async function getRPSMatchRounds(matchId: string): Promise<{
    success: boolean
    rounds: RPSRound[]
    error?: string
}> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data, error } = await supabase.rpc('rps_get_match_rounds', {
            p_match_id: matchId,
        })
        if (error) {
            console.error('getRPSMatchRounds RPC error:', error)
            return { success: false, rounds: [], error: error.message }
        }
        const result = data as { success: boolean; rounds: RPSRound[]; error?: string }
        return { success: result.success, rounds: result.rounds || [], error: result.error }
    } catch (err: any) {
        return { success: false, rounds: [], error: err.message }
    }
}

// ─── Get player's match history ─────────────────────────────────────

export async function getPlayerRPSHistory(limit: number = 20): Promise<{
    success: boolean
    matches: RPSMatchHistoryItem[]
    error?: string
}> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data, error } = await supabase.rpc('rps_get_player_history', {
            p_limit: limit,
        })
        if (error) {
            console.error('getPlayerRPSHistory RPC error:', error)
            return { success: false, matches: [], error: error.message }
        }
        const result = data as { success: boolean; matches: RPSMatchHistoryItem[]; error?: string }
        return { success: result.success, matches: result.matches || [], error: result.error }
    } catch (err: any) {
        return { success: false, matches: [], error: err.message }
    }
}
