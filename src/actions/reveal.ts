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

function getFriendlySource(ref: string): string {
    if (!ref || ref === 'direct') return 'Direct link'
    try {
        const url = new URL(ref)
        const host = url.hostname.replace('www.', '')
        if (host.includes('instagram')) return 'Instagram'
        if (host.includes('snapchat')) return 'Snapchat'
        if (host.includes('tiktok')) return 'TikTok'
        if (host.includes('twitter') || host.includes('x.com')) return 'X (Twitter)'
        if (host.includes('facebook') || host.includes('fb.com')) return 'Facebook'
        if (host.includes('whatsapp')) return 'WhatsApp'
        if (host.includes('t.me') || host.includes('telegram')) return 'Telegram'
        if (host.includes('reddit')) return 'Reddit'
        if (host.includes('discord')) return 'Discord'
        if (host.includes('say-app')) return 'Say App'
        return host
    } catch {
        return 'Unknown source'
    }
}

async function getLocationFromIP(ip: string): Promise<string> {
    if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return 'Unknown'
    try {
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon`, {
            signal: AbortSignal.timeout(3000) // 3s timeout
        })
        if (!res.ok) return 'Unknown'
        const data = await res.json()
        if (data.status === 'success') {
            return `${data.city}, ${data.regionName}, ${data.country}`
        }
        return 'Unknown'
    } catch {
        return 'Unknown'
    }
}

async function getCoordsFromIP(ip: string): Promise<{ lat: string; lon: string } | null> {
    if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return null
    try {
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon`, {
            signal: AbortSignal.timeout(3000)
        })
        if (!res.ok) return null
        const data = await res.json()
        if (data.status === 'success') {
            return { lat: String(data.lat), lon: String(data.lon) }
        }
        return null
    } catch {
        return null
    }
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
                return { success: false, message: `Need ${cost} Stars to reveal hint` }
            }
            throw xpError
        }

        // Verify XP was actually spent
        if (!xpResult || (xpResult as any).success === false) {
            const errorMsg = (xpResult as any)?.error || 'Failed to spend Stars'
            console.error('XP spend failed:', errorMsg)
            return { success: false, message: errorMsg.includes('Insufficient') ? `Need ${cost} Stars to reveal hint` : 'Failed to spend Stars' }
        }

        console.log('✅ XP spent successfully:', xpResult)

        // 2. Fetch Hint from Metadata
        const { data: confession } = await supabase
            .from('confessions')
            .select('message')
            .eq('id', messageId)
            .single()

        const hints: Record<string, string> = {}

        if (confession?.message) {
            const metaMatch = confession.message.match(/\[META:(.*)\]$/s)
            if (metaMatch && metaMatch[1]) {
                try {
                    const meta = JSON.parse(metaMatch[1])
                    hints['Device'] = getFriendlyUA(meta.ua)
                    hints['Browser'] = getFriendlyBrowser(meta.ua)
                    hints['Language'] = meta.lang?.split(',')[0] || 'Unknown'
                    hints['Source'] = getFriendlySource(meta.ref)

                    if (meta.t) {
                        hints['Time Sent'] = new Date(meta.t).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                        })
                    }

                    // Location from IP (async)
                    const location = await getLocationFromIP(meta.ip)
                    hints['Location'] = location

                    if (isPro) {
                        const coords = await getCoordsFromIP(meta.ip)
                        if (coords) {
                            hints['Latitude'] = coords.lat
                            hints['Longitude'] = coords.lon
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse metadata", e)
                    hints['Device'] = 'Unknown'
                }
            } else {
                hints['Device'] = 'Mobile device (no metadata)'
            }
        } else {
            hints['Device'] = 'Unknown'
        }

        return {
            success: true,
            data: { hints }
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

        // Check if already revealed
        const { data: scoreData } = await supabase
            .from('dykm_scores')
            .select('responder_revealed')
            .eq('id', scoreId)
            .single()

        if (scoreData?.responder_revealed) {
            return { success: true, message: 'Already revealed!' }
        }

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
                return { success: false, message: `Need ${cost} Stars to reveal` }
            }
            throw xpError
        }

        if (!xpResult || (xpResult as any).success === false) {
            return { success: false, message: (xpResult as any)?.error || 'Failed to spend Stars' }
        }

        // 2. Mark as revealed in dykm_scores
        await supabase
            .from('dykm_scores')
            .update({ responder_revealed: true })
            .eq('id', scoreId)

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
                return { success: false, message: `Need ${cost} Stars to reveal` }
            }
            throw xpError
        }

        if (!xpResult || (xpResult as any).success === false) {
            return { success: false, message: (xpResult as any)?.error || 'Failed to spend Stars' }
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
