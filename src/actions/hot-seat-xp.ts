'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

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

        // 2. Fetch the question to get asker_id and check rewarded flag
        const { data: question } = await supabase
            .from('hot_seat_questions')
            .select('asker_id, status, rewarded')
            .eq('id', questionId)
            .single()

        if (!question) {
            console.error('Question not found:', questionId)
            return
        }

        // 3. Mark question as timed_out (or skipped) — only if currently active
        const { error: updateError } = await supabase
            .from('hot_seat_questions')
            .update({ status: 'timed_out' })
            .eq('id', questionId)
            .eq('status', 'active')

        if (updateError) {
            console.error('Failed to update question status:', updateError)
            return
        }

        // 4. Deduct XP from Host
        const { error: xpError } = await supabase.rpc('spend_xp', {
            p_user_id: user.id,
            p_amount: 10,
            p_reason: 'Hot Seat Timeout/Skip',
            p_metadata: { session_id: sessionId, question_id: questionId }
        })

        if (xpError) console.error('XP penalty failed:', xpError)

        // 5. Reward the question asker with 10 stars (idempotent — only once per question)
        if (question.asker_id && !question.rewarded) {
            // Atomically set rewarded = true to prevent duplicate rewards
            const { data: rewardUpdate, error: rewardFlagError } = await supabase
                .from('hot_seat_questions')
                .update({ rewarded: true })
                .eq('id', questionId)
                .eq('rewarded', false)
                .select('id')
                .single()

            // Only credit stars if we successfully flipped the flag (prevents race conditions)
            if (rewardUpdate && !rewardFlagError) {
                const { error: rewardError } = await supabase.rpc('add_xp', {
                    p_user_id: question.asker_id,
                    p_amount: 10,
                    p_reason: '🔥 Hot Seat: Your question was skipped!',
                    p_metadata: { session_id: sessionId, question_id: questionId }
                })

                if (rewardError) {
                    console.error('Asker reward failed:', rewardError)
                    // Revert the flag if XP credit failed
                    await supabase
                        .from('hot_seat_questions')
                        .update({ rewarded: false })
                        .eq('id', questionId)
                }
            }
        }

    } catch (error) {
        console.error('Hot Seat penalty error:', error)
    }
}
