import { createClient } from '@/lib/supabase/client'

export interface XPTransaction {
  id: string
  user_id: string
  amount: number
  type: 'earn' | 'spend'
  reason: string
  metadata?: any
  created_at: string
}

export interface XPResult {
  success: boolean
  new_balance?: number
  transaction_id?: string
  error?: string
  current_balance?: number
  required?: number
}

// Import this dynamically to avoid circular dependencies
let showXPNotification: ((amount: number, reason: string) => void) | null = null

export function setXPNotificationHandler(handler: (amount: number, reason: string) => void) {
  showXPNotification = handler
}

/**
 * Award XP to the current user
 */
export async function earnXP(
  amount: number,
  reason: string,
  metadata?: any,
  showNotification: boolean = true
): Promise<XPResult> {
  const supabase = createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Fetch multipliers directly for security
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_pro, bonus_2x_started_at')
      .eq('id', user.id)
      .single()

    const isProProfile = profile?.is_pro ?? false
    const hasBonus = isBonusActive(profile?.bonus_2x_started_at)

    const finalAmount = applyRewardMultiplier(amount, isProProfile, hasBonus)
    const finalReason = formatRewardReason(reason, isProProfile, hasBonus)

    const { data, error } = await supabase.rpc('add_xp', {
      p_user_id: user.id,
      p_amount: finalAmount,
      p_reason: finalReason,
      p_metadata: metadata || null
    })

    if (error) throw error

    const result = data as XPResult

    // Notification is now handled globally via Realtime subscription in XPNotificationProvider
    // to support server-side events (webhooks, penalties) consistently.
    // if (result.success && showNotification && showXPNotification) {
    //   showXPNotification(finalAmount, finalReason)
    // }

    return result
  } catch (error) {
    console.error('Error earning XP:', error)
    return { success: false, error: 'Failed to earn XP' }
  }
}

// ... existing spendXP ...

export const PRO_REWARD_MULTIPLIER = 2
export const BONUS_DURATION_DAYS = 7

/**
 * Check if the 7-day 2x bonus is currently active based on its start date.
 */
export function isBonusActive(bonusStartDate: string | null): boolean {
  if (!bonusStartDate) return false
  const start = new Date(bonusStartDate).getTime()
  const now = Date.now()
  const daysDiff = (now - start) / (1000 * 60 * 60 * 24)
  return daysDiff < BONUS_DURATION_DAYS
}

/**
 * Apply Pro and Weekly Bonus multipliers to a base XP amount. 
 * Both multipliers could stack, or we can just apply a max multiplier. Let's make it additive or independent.
 * For now, returning max multiplier to prevent insane inflation, or apply sequentially. Let's cap at x4.
 */
export function applyRewardMultiplier(amount: number, isPro: boolean, isBonusActive: boolean): number {
  let multiplier = 1
  if (isPro) multiplier *= PRO_REWARD_MULTIPLIER
  if (isBonusActive) multiplier *= 2
  return amount * multiplier
}

/**
 * Format reward reason for transactions (e.g. "(2x Pro Bonus)" suffix).
 */
export function formatRewardReason(reason: string, isPro: boolean, isBonusActive: boolean): string {
  const suffixes = []
  if (isPro) suffixes.push('2x Pro')
  if (isBonusActive) suffixes.push('2x Weekly Bonus')
  
  if (suffixes.length > 0) {
    return `${reason} (${suffixes.join(' + ')})`
  }
  return reason
}

/**
 * XP reward constants — single source of truth for all reward amounts.
 * Server actions and API routes should import these instead of hardcoding.
 */
export const XP_REWARDS = {
  PROFILE_CREATED: 100,
  DAILY_LOGIN: 5,
  TOD_PARTICIPANT_JOINED: 5,
  MESSAGE_RECEIVED: 2,           // Confession, AMA, DYKM, Anonymous
  HOT_QUESTION_RECEIVED: 5,
  SHARE_LINK: 15,
} as const

/**
 * XP costs
 */
export const XP_COSTS = {
  REVEAL_SENDER_HINT: 500,
  REVEAL_SENDER_HINT_PRO: 50,
  REVEAL_DYKM_ANSWERER: 5,
  REVEAL_DYKM_ANSWER: 5,
  CUSTOM_THEME: 500,
  PREMIUM_STICKER: 200,
  UNLOCK_FEATURE: 300,
} as const

/**
 * XP penalties (make sure to use spendXP for these, or create a deductXP helper if needed)
 */
export const XP_PENALTIES = {
  SKIP_ROUND_NO_ANSWER: 10,
  SYSTEM_CHOSE_MODE: 2,
} as const
/**
 * Spend XP for the current user (with balance validation)
 */
export async function spendXP(
  amount: number,
  reason: string,
  metadata?: any
): Promise<XPResult> {
  const supabase = createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { data, error } = await supabase.rpc('spend_xp', {
      p_user_id: user.id,
      p_amount: amount,
      p_reason: reason,
      p_metadata: metadata || null
    })

    if (error) throw error
    return data as XPResult
  } catch (error) {
    console.error('Error spending XP:', error)
    return { success: false, error: 'Failed to spend XP' }
  }
}

/**
 * Get current XP balance
 */
export async function getXPBalance(): Promise<number> {
  const supabase = createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0

    const { data, error } = await supabase
      .from('profiles')
      .select('xp_balance')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return data?.xp_balance || 0
  } catch (error) {
    console.error('Error getting XP balance:', error)
    return 0
  }
}

/**
 * Get XP transaction history
 */
export async function getXPTransactions(limit: number = 20): Promise<XPTransaction[]> {
  const supabase = createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('xp_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting XP transactions:', error)
    return []
  }
}
