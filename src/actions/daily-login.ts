'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { XP_REWARDS } from '@/hooks/xp'

export type DailyLoginResult = {
    success: boolean
    awarded: boolean
    xp?: number
    message?: string
}

export async function checkDailyLogin(isPro: boolean = false): Promise<DailyLoginResult> {
    const supabase = await createSupabaseServerClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, awarded: false, message: 'Not authenticated' }

        // Get profile to check last login date
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('last_login_date')
            .eq('id', user.id)
            .single()

        if (profileError) throw profileError

        const today = new Date().toISOString().split('T')[0]

        // Check if already logged in today
        if (profile.last_login_date === today) {
            return { success: true, awarded: false, message: 'Already claimed today' }
        }

        // Award XP
        const amount = isPro ? XP_REWARDS.DAILY_LOGIN * 2 : XP_REWARDS.DAILY_LOGIN
        const reason = isPro ? 'Daily Login (2x Pro Bonus)' : 'Daily Login'

        // 1. Update last_login_date
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ last_login_date: today })
            .eq('id', user.id)

        if (updateError) throw updateError

        // 2. Add XP
        // Note: detailed transaction logging happens in the DB trigger/RPC usually, 
        // or we can call rpc here if earnXP wasn't client-side only. 
        // Since earnXP logic in hooks/xp.ts is client-side/mixed, we use RPC directly here for server action.
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
