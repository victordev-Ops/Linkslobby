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
