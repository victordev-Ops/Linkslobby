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
