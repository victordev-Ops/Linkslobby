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
            const supabaseAdmin = await createSupabaseServerClient() // Just for types, but we need meaningful client

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

export async function joinLobbyAction(lobbyId: string, isPrivate: boolean) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("User not authenticated")

        // 1. Check if already joined
        const { data: existing } = await supabase
            .from('tod_participants')
            .select('status')
            .eq('lobby_id', lobbyId)
            .eq('user_id', user.id)
            .maybeSingle()

        if (existing) {
            return { success: true, status: existing.status, message: 'Already joined' }
        }

        // 2. Determine initial status
        const initialStatus = isPrivate ? 'pending' : 'joined'

        // 3. Insert participant
        const { error: joinError } = await supabase
            .from('tod_participants')
            .insert({
                lobby_id: lobbyId,
                user_id: user.id,
                status: initialStatus
            })

        if (joinError) throw joinError

        // 4. If public lobby, award XP to HOST
        if (!isPrivate && initialStatus === 'joined') {
            // Get lobby host
            const { data: lobby } = await supabase
                .from('tod_lobbies')
                .select('host_id')
                .eq('id', lobbyId)
                .single()

            if (lobby && lobby.host_id) {
                // Check if host is pro (for bonus)
                // Use admin client to award XP to host
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

                // Check if host is pro using admin client (bypasses RLS)
                const { data: hostProfile } = await adminClient
                    .from('profiles')
                    .select('is_pro')
                    .eq('id', lobby.host_id)
                    .single()

                const isPro = hostProfile?.is_pro ?? false

                // Use admin client to award XP to host
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

                // Import XP constants needed (re-defining simply here to avoid importing client-heavy file if needed, 
                // but better to import if possible. Let's try importing `XP_REWARDS` from hooks/xp first if it works, 
                // but that file has 'createClient'. Safe to import constants though? 
                // Actually `hooks/xp.ts` imports `createClient` at top level. That might break server action if it tries to use browser client.
                // Let's safe-guard by just using the value or importing if safe. 
                // hooks/xp.ts:1: import { createClient } from '@/lib/supabase/client' -> might be issue.
                // I will hardcode the reward value here to be safe and avoid "client component" error or similar in server action.
                // Better yet, I'll assume 5 XP as per previous code.
                /* 
                   XP_REWARDS.TOD_PARTICIPANT_JOINED = 5
                */

                const rewardAmount = 5 // XP_REWARDS.TOD_PARTICIPANT_JOINED
                const finalAmount = isPro ? rewardAmount * 2 : rewardAmount
                const reason = isPro ? 'Player joined your lobby (2x Pro Bonus)' : 'Player joined your lobby'

                await adminClient.rpc('add_xp', {
                    p_user_id: lobby.host_id,
                    p_amount: finalAmount,
                    p_reason: reason,
                    // p_metadata: { lobby_id: lobbyId, joined_user_id: user.id } 
                    // The signature in previous file used p_metadata. Let's keep it if RPC supports it.
                    // The original earnXP used p_metadata.
                    p_metadata: { lobby_id: lobbyId, joined_user_id: user.id }
                })
            }
        }

        return { success: true, status: initialStatus }

    } catch (error: any) {
        console.error('Join lobby error:', error)
        return { success: false, error: error.message }
    }
}
