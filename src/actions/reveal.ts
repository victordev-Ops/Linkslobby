'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { XP_COSTS } from '@/hooks/xp'

function getFriendlyUA(ua: string) {
    if (!ua) return "Unknown Device"
    if (ua.includes('iPhone')) return 'iPhone'
    if (ua.includes('Android')) return 'Android Phone'
    if (ua.includes('iPad')) return 'iPad'
    if (ua.includes('Windows')) return 'Windows PC'
    if (ua.includes('Macintosh')) return 'Mac'
    return 'Web Browser'
}

function getFriendlyBrowser(ua: string) {
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
    if (ua.includes('Edge')) return 'Edge'
    return 'Browser'
}

export type RevealResult = {
    success: boolean
    message?: string
    data?: any
}

export async function revealSenderHint(messageId: string): Promise<RevealResult> {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, message: 'Not authenticated' }

        // Fetch is_pro from DB instead of trusting client parameter
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_pro')
            .eq('id', user.id)
            .single()

        const isPro = profile?.is_pro ?? false
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

        // 2. Fetch Hint from Metadata
        const { data: confession } = await supabase
            .from('confessions')
            .select('message')
            .eq('id', messageId)
            .single()

        let hint = "Sender is using a mobile device"

        if (confession?.message) {
            const metaMatch = confession.message.match(/\[META:(.*)\]$/s)
            if (metaMatch && metaMatch[1]) {
                try {
                    const meta = JSON.parse(metaMatch[1])
                    const device = getFriendlyUA(meta.ua)
                    const browser = getFriendlyBrowser(meta.ua)

                    // Add some variability or depth for Pro users later if needed
                    hint = `The sender is using ${device} on ${browser}`

                    if (isPro) {
                        // For Pro, we can add more info like language or approximate location if we had a geo lookup
                        hint += `. Browser language: ${meta.lang.split(',')[0]}`
                    }
                } catch (e) {
                    console.error("Failed to parse metadata", e)
                }
            }
        }

        return {
            success: true,
            data: { hint }
        }

    } catch (error) {
        console.error('Reveal hint error:', error)
        return { success: false, message: 'Failed to reveal hint' }
    }
}

export async function revealDYKMRespondent(scoreId: string): Promise<RevealResult> {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, message: 'Not authenticated' }

        const cost = XP_COSTS.REVEAL_DYKM_ANSWERER

        // 1. Spend XP
        const { data: xpResult, error: xpError } = await supabase.rpc('spend_xp', {
            p_user_id: user.id,
            p_amount: cost,
            p_reason: 'Reveal DYKM Respondent',
            p_metadata: { score_id: scoreId }
        })

        if (xpError) {
            if (xpError.message.includes('Insufficient')) {
                return { success: false, message: `Need ${cost} XP to reveal` }
            }
            throw xpError
        }

        if (!xpResult || (xpResult as any).success === false) {
            return { success: false, message: (xpResult as any)?.error || 'Failed to spend XP' }
        }

        return { success: true, message: 'Respondent revealed!' }

    } catch (error) {
        console.error('Reveal DYKM respondent error:', error)
        return { success: false, message: 'Failed to reveal respondent' }
    }
}

export async function revealDYKMAnswer(scoreId: string, questionIndex: number): Promise<RevealResult> {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, message: 'Not authenticated' }

        // 1. Check if already revealed
        const { data: existing } = await supabase
            .from('dykm_response_reveals')
            .select('id')
            .eq('score_id', scoreId)
            .eq('question_index', questionIndex)
            .eq('viewer_id', user.id)
            .single()

        if (existing) {
            return { success: true, message: 'Already revealed' }
        }

        // 2. Spend XP
        const cost = XP_COSTS.REVEAL_DYKM_ANSWER
        const { data: xpResult, error: xpError } = await supabase.rpc('spend_xp', {
            p_user_id: user.id,
            p_amount: cost,
            p_reason: 'Reveal DYKM Answer',
            p_metadata: { score_id: scoreId, question_index: questionIndex }
        })

        if (xpError) {
            if (xpError.message.includes('Insufficient')) {
                return { success: false, message: `Need ${cost} XP to reveal` }
            }
            throw xpError
        }

        if (!xpResult || (xpResult as any).success === false) {
            return { success: false, message: (xpResult as any)?.error || 'Failed to spend XP' }
        }

        // 3. Track reveal
        const { error: revealError } = await supabase
            .from('dykm_response_reveals')
            .insert({
                score_id: scoreId,
                question_index: questionIndex,
                viewer_id: user.id
            })

        if (revealError) throw revealError

        return { success: true, message: 'Answer revealed!' }

    } catch (error) {
        console.error('Reveal DYKM answer error:', error)
        return { success: false, message: 'Failed to reveal answer' }
    }
}
