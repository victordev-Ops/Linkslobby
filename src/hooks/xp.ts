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

/**
 * Award XP to the current user
 */
export async function earnXP(
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

    const { data, error } = await supabase.rpc('add_xp', {
      p_user_id: user.id,
      p_amount: amount,
      p_reason: reason,
      p_metadata: metadata || null
    })

    if (error) throw error
    return data as XPResult
  } catch (error) {
    console.error('Error earning XP:', error)
    return { success: false, error: 'Failed to earn XP' }
  }
}

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

/**
 * XP reward constants - customize these based on your app's economy
 */
export const XP_REWARDS = {
  PROFILE_CREATED: 100,
  FIRST_CONFESSION_SENT: 50,
  FIRST_CONFESSION_RECEIVED: 50,
  CONFESSION_SENT: 10,
  CONFESSION_RECEIVED: 5,
  AMA_STICKER_CREATED: 25,
  DAILY_LOGIN: 10,
  SHARE_LINK: 15,
} as const

/**
 * XP costs - customize these based on your app's features
 */
export const XP_COSTS = {
  CUSTOM_THEME: 500,
  PREMIUM_STICKER: 200,
  UNLOCK_FEATURE: 300,
} as const
