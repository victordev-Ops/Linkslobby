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

        const amount = applyProRewardMultiplier(XP_REWARDS.DAILY_LOGIN, isPro)
        const reason = formatRewardReason('Daily Login', isPro)

        // Atomic claim using RPC
        const { data: claimResult, error: claimError } = await supabase.rpc('claim_daily_login_xp', {
            p_user_id: user.id,
            p_today: today,
            p_amount: amount,
            p_reason: reason
        })

        if (claimError) throw claimError

        if (!claimResult.success) {
            return { success: true, awarded: false, message: claimResult.message }
        }

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
