'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { XP_REWARDS, applyRewardMultiplier, formatRewardReason, isBonusActive } from '@/hooks/xp'

export type DailyLoginResult = {
    success: boolean
    awarded: boolean
    xp?: number
    message?: string
    new_streak?: number
    bonus_activated?: boolean
}

export async function checkDailyLogin(): Promise<DailyLoginResult> {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, awarded: false, message: 'Not authenticated' }

        // Fetch is_pro from DB instead of trusting client parameter
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_pro, bonus_2x_started_at')
            .eq('id', user.id)
            .single()

        const isPro = profile?.is_pro ?? false
        const hasBonus = isBonusActive(profile?.bonus_2x_started_at)

        const today = new Date().toISOString().split('T')[0]

        const amount = applyRewardMultiplier(XP_REWARDS.DAILY_LOGIN, isPro, hasBonus)
        const reason = formatRewardReason('Daily Login', isPro, hasBonus)

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

        let message = `Crit! You earned ${amount} XP for checking in!`
        if (claimResult.bonus_activated) {
            message = `🔥 7 Day Streak! You earned ${amount} XP and activated a 2X WEEKLY BONUS!`
            
            // Notify about the bonus
            await supabase.from('xp_transactions').insert({
                user_id: user.id,
                amount: 0,
                type: 'earn',
                reason: `🔥 7-DAY STREAK: 2x XP Bonus Activated! Valid for 7 days.`,
                is_read: false,
            })
        } else if (claimResult.new_streak > 1) {
            message = `🔥 ${claimResult.new_streak} Day Streak! You earned ${amount} XP!`
        }

        return {
            success: true,
            awarded: true,
            xp: amount,
            new_streak: claimResult.new_streak,
            bonus_activated: claimResult.bonus_activated,
            message
        }

    } catch (error) {
        console.error('Daily login error:', error)
        return { success: false, awarded: false, message: 'Failed to process daily login' }
    }
}
