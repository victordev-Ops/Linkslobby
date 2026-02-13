'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
// import { XP_PENALTIES } from '@/hooks/xp'

export async function penalizeHotSeatTimeout(sessionId: string, questionId: string) {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Verify host and game state
        const { data: session } = await supabase
            .from('hot_seat_sessions')
            .select('host_id')
            .eq('id', sessionId)
            .single()

        if (!session || session.host_id !== user.id) {
            console.error('Unauthorized Hot Seat penalty attempt')
            return
        }

        // 2. Mark question as timed out (or skipped)
        // Only if currently active
        const { error: updateError } = await supabase
            .from('hot_seat_questions')
            .update({ status: 'timed_out' })
            .eq('id', questionId)
            .eq('status', 'active')

        if (updateError) {
            console.error('Failed to update question status:', updateError)
            return
        }

        // 3. Deduct XP from Host
        const { error: xpError } = await supabase.rpc('spend_xp', {
            p_user_id: user.id,
            p_amount: 10, // Hardcoded 10 as per request "losing 10 stars"
            p_reason: 'Hot Seat Timeout/Skip',
            p_metadata: { session_id: sessionId, question_id: questionId }
        })

        if (xpError) console.error('XP penalty failed:', xpError)

    } catch (error) {
        console.error('Hot Seat penalty error:', error)
    }
}
