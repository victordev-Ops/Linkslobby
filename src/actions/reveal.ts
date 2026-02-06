'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { XP_COSTS } from '@/hooks/xp'

export type RevealResult = {
    success: boolean
    message?: string
    data?: any
}

export async function revealSenderHint(messageId: string, isPro: boolean = false): Promise<RevealResult> {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, message: 'Not authenticated' }

        const cost = isPro ? XP_COSTS.REVEAL_SENDER_HINT_PRO : XP_COSTS.REVEAL_SENDER_HINT

        // 1. Spend XP
        const { data: xpResult, error: xpError } = await supabase.rpc('spend_xp', {
            p_user_id: user.id,
            p_amount: cost,
            p_reason: 'Reveal Sender Hint',
            p_metadata: { message_id: messageId }
        })

        if (xpError) {
            console.error('XP spend error:', xpError)
            // Handle "insufficient funds" or other DB errors
            if (xpError.message.includes('Insufficient') || xpError.message.includes('insufficient')) {
                return { success: false, message: `Need ${cost} XP to reveal hint` }
            }
            throw xpError
        }

        // Verify XP was actually spent
        if (!xpResult || (xpResult as any).success === false) {
            const errorMsg = (xpResult as any)?.error || 'Failed to spend XP'
            console.error('XP spend failed:', errorMsg)
            return { success: false, message: errorMsg.includes('Insufficient') ? `Need ${cost} XP to reveal hint` : 'Failed to spend XP' }
        }

        console.log('✅ XP spent successfully:', xpResult)

        // 2. Fetch Hint (Logic depends on how hints are stored/generated)
        // For now, we'll return a placeholder or partial data since implementation details of hints weren't provided.
        // Assuming backend might generate a hint on the fly or fetch metadata.

        return {
            success: true,
            data: { hint: "Generic Hint: Sender is using an iPhone" } // Replace with actual hint logic 
        }

    } catch (error) {
        console.error('Reveal hint error:', error)
        return { success: false, message: 'Failed to reveal hint' }
    }
}

export async function revealDYKMAnswerer(resultId: string): Promise<RevealResult> {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, message: 'Not authenticated' }

        const cost = XP_COSTS.REVEAL_DYKM_ANSWERER

        // 1. Spend XP
        const { error: xpError } = await supabase.rpc('spend_xp', {
            p_user_id: user.id,
            p_amount: cost,
            p_reason: 'Reveal DYKM Answerer',
            p_metadata: { result_id: resultId }
        })

        if (xpError) {
            if (xpError.message.includes('Insufficient')) {
                return { success: false, message: `Need ${cost} XP to reveal` }
            }
            throw xpError
        }

        // 2. Fetch the answerer info
        // This assumes there's a table `dykm_responses` or similar where we can find who answered
        // For now, we proceed as if the client handles the fetching or we return it here.

        return { success: true, message: 'Answerer revealed!' }

    } catch (error) {
        console.error('Reveal DYKM error:', error)
        return { success: false, message: 'Failed to reveal answerer' }
    }
}
