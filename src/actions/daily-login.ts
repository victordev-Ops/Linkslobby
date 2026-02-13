'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { XP_REWARDS, applyProRewardMultiplier, formatRewardReason } from '@/hooks/xp'

export type DailyLoginResult = {
    success: boolean
    awarded: boolean
    xp?: number
    message?: string
}

export async function checkDailyLogin(): Promise<DailyLoginResult> {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, awarded: false, message: 'Not authenticated' }

        // Fetch is_pro from DB instead of trusting client parameter
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_pro')
            .eq('id', user.id)
            .single()

        const isPro = profile?.is_pro ?? false

        const today = new Date().toISOString().split('T')[0]

        // Check if already claimed today by looking at XP transactions
        const { data: existingClaim } = await supabase
            .from('xp_transactions')
            .select('id')
            .eq('user_id', user.id)
            .eq('metadata->>type', 'daily_login')
            .eq('metadata->>date', today)
            .maybeSingle()

        if (existingClaim) {
            return { success: true, awarded: false, message: 'Already claimed today' }
        }

        const amount = applyProRewardMultiplier(XP_REWARDS.DAILY_LOGIN, isPro)
        const reason = formatRewardReason('Daily Login', isPro)

        const { error: xpError } = await supabase.rpc('add_xp', {
            p_user_id: user.id,
            p_amount: amount,
            p_reason: reason,
            p_metadata: { type: 'daily_login', date: today }
        })

        if (xpError) throw xpError

        return {
            success: true,
            awarded: true,
            xp: amount,
            message: `Crit! You earned ${amount} XP for checking in!`
        }

    } catch (error) {
        console.error('Daily login error:', error)
        return { success: false, awarded: false, message: 'Failed to process daily login' }
    }
}
