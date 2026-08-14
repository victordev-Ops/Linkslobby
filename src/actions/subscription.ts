// src/actions/subscription.ts — Server actions for subscription management
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getStripe, STRIPE_PRICES, type StripePlan } from '@/lib/stripe'
import { initializeTransaction, verifyTransaction, PAYSTACK_PLANS, type PaystackPlan } from '@/lib/paystack'

// ─── Types ──────────────────────────────────────────────────────────

export type SubscriptionInfo = {
    id: string
    provider: 'stripe' | 'paystack'
    plan: 'weekly' | 'monthly' | 'annual'
    status: 'active' | 'past_due' | 'cancelled' | 'expired' | 'trialing'
    current_period_end: string | null
    cancel_at_period_end: boolean
}

// ─── Get subscription status ────────────────────────────────────────

export async function getSubscriptionStatus(): Promise<{
    success: boolean
    subscription: SubscriptionInfo | null
    error?: string
}> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, subscription: null, error: 'Not authenticated' }
        }

        const { data, error } = await supabase
            .from('subscriptions')
            .select('id, provider, plan, status, current_period_end, cancel_at_period_end')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing', 'past_due'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('Error fetching subscription:', error)
            return { success: false, subscription: null, error: error.message }
        }

        return { success: true, subscription: data as SubscriptionInfo | null }
    } catch (err: any) {
        return { success: false, subscription: null, error: err.message }
    }
}

// ─── Create Stripe Checkout ─────────────────────────────────────────

export async function createStripeCheckout(plan: StripePlan): Promise<{
    success: boolean
    url?: string
    error?: string
}> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'Not authenticated' }
        }

        // Check for existing active subscription
        const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing'])
            .limit(1)
            .maybeSingle()

        if (existingSub) {
            return { success: false, error: 'You already have an active subscription' }
        }

        const priceId = STRIPE_PRICES[plan]
        if (!priceId) {
            return { success: false, error: 'Invalid plan selected' }
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        const stripe = getStripe()

        // Check if user already has a Stripe customer ID
        const adminSupabase = createSupabaseAdminClient()
        const { data: prevSub } = await adminSupabase
            .from('subscriptions')
            .select('provider_customer_id')
            .eq('user_id', user.id)
            .eq('provider', 'stripe')
            .not('provider_customer_id', 'is', null)
            .limit(1)
            .maybeSingle()

        const sessionParams: any = {
            mode: 'subscription',
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${siteUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteUrl}/upgrade?cancelled=true`,
            metadata: { user_id: user.id, plan },
            subscription_data: {
                metadata: { user_id: user.id, plan },
            },
        }

        if (prevSub?.provider_customer_id) {
            sessionParams.customer = prevSub.provider_customer_id
        } else {
            sessionParams.customer_email = user.email
        }

        const session = await stripe.checkout.sessions.create(sessionParams)

        return { success: true, url: session.url! }
    } catch (err: any) {
        console.error('Stripe checkout error:', err)
        return { success: false, error: err.message }
    }
}

// ─── Create Paystack Checkout ───────────────────────────────────────

export async function createPaystackCheckout(plan: PaystackPlan): Promise<{
    success: boolean
    url?: string
    error?: string
}> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'Not authenticated' }
        }

        // Check for existing active subscription
        const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing'])
            .limit(1)
            .maybeSingle()

        if (existingSub) {
            return { success: false, error: 'You already have an active subscription' }
        }

        const planCode = PAYSTACK_PLANS[plan]
        if (!planCode) {
            return { success: false, error: 'Invalid plan selected' }
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

        // NOTE: this `amount` is cosmetic only. When a `plan` code is also
        // passed to /transaction/initialize, Paystack ignores `amount` and
        // charges whatever that plan is configured for on the dashboard. If
        // checkout ever shows a price that doesn't match the plan the user
        // picked, the bug is a mismatched plan code in PAYSTACK_PLANS below
        // (i.e. the .env values), not this amount map.
        const amounts: Record<string, number> = {
            weekly: 499 * 100,    // ₦499
            monthly: 1499 * 100,  // ₦1,499
            annual: 6999 * 100,   // ₦6,999
        }

        const result = await initializeTransaction({
            email: user.email!,
            amount: amounts[plan] || amounts.monthly,
            currency: 'NGN',
            plan: planCode,
            metadata: {
                user_id: user.id,
                plan,
                custom_fields: [
                    { display_name: 'Plan', variable_name: 'plan', value: plan },
                ],
            },
            callback_url: `${siteUrl}/upgrade/success?provider=paystack&reference={reference}`,
        })

        return { success: true, url: result.authorization_url }
    } catch (err: any) {
        console.error('Paystack checkout error:', err)
        return { success: false, error: err.message }
    }
}

// ─── Confirm Paystack Payment (fallback for /upgrade/success) ───────
//
// The webhook is the primary path that flips is_pro to true. This action
// is a safety net for the redirect-back page: if the webhook is delayed,
// misconfigured, or blocked (e.g. local dev without a tunnel), the user
// landing on /upgrade/success can still self-heal their own subscription
// by verifying the transaction directly against the Paystack API and
// upserting the same way the webhook does.
//
// Idempotent: verifyTransaction + upsert + sync_pro_status all resolve
// to the same end state whether the webhook already ran or not.
export async function confirmPaystackPayment(reference: string): Promise<{
    success: boolean
    isPro?: boolean
    error?: string
}> {
    try {
        if (!reference) {
            return { success: false, error: 'Missing transaction reference' }
        }

        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'Not authenticated' }
        }

        const verified = await verifyTransaction(reference)

        if (verified.status !== 'success') {
            return { success: false, error: 'Payment was not successful' }
        }

        // Guard against confirming someone else's transaction reference.
        if (verified.customer?.email && user.email && verified.customer.email.toLowerCase() !== user.email.toLowerCase()) {
            return { success: false, error: 'This transaction does not belong to the current user' }
        }

        const adminSupabase = createSupabaseAdminClient()

        const subCode = verified.subscription_code
        const planObject = verified.plan_object

        if (subCode) {
            const plan = planObject ? mapPaystackInterval(planObject.interval) : 'monthly'

            const { error } = await adminSupabase
                .from('subscriptions')
                .upsert({
                    user_id: user.id,
                    provider: 'paystack',
                    provider_subscription_id: subCode,
                    provider_customer_id: verified.customer?.customer_code,
                    plan,
                    status: 'active',
                    current_period_start: new Date().toISOString(),
                    current_period_end: planObject ? calculateNextPeriod(planObject.interval) : null,
                    cancel_at_period_end: false,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'provider,provider_subscription_id' })

            if (error) {
                console.error('Failed to upsert subscription on confirm:', error)
                return { success: false, error: 'Failed to record subscription' }
            }
        }

        await adminSupabase.rpc('sync_pro_status', { target_user_id: user.id })

        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('is_pro')
            .eq('id', user.id)
            .maybeSingle()

        return { success: true, isPro: !!profile?.is_pro }
    } catch (err: any) {
        console.error('Confirm Paystack payment error:', err)
        return { success: false, error: err.message }
    }
}

function mapPaystackInterval(interval: string): 'weekly' | 'monthly' | 'annual' {
    switch (interval) {
        case 'weekly': return 'weekly'
        case 'monthly': return 'monthly'
        case 'annually': return 'annual'
        default: return 'monthly'
    }
}

function calculateNextPeriod(interval: string): string {
    const now = new Date()
    switch (interval) {
        case 'weekly':
            now.setDate(now.getDate() + 7)
            break
        case 'monthly':
            now.setMonth(now.getMonth() + 1)
            break
        case 'annually':
            now.setFullYear(now.getFullYear() + 1)
            break
        default:
            now.setMonth(now.getMonth() + 1)
    }
    return now.toISOString()
}

// ─── Cancel Subscription ────────────────────────────────────────────

export async function cancelSubscription(): Promise<{
    success: boolean
    error?: string
}> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'Not authenticated' }
        }

        const { data: sub, error: fetchError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (fetchError || !sub) {
            return { success: false, error: 'No active subscription found' }
        }

        if (sub.provider === 'stripe') {
            const stripe = getStripe()
            await stripe.subscriptions.update(sub.provider_subscription_id, {
                cancel_at_period_end: true,
            })
        } else if (sub.provider === 'paystack') {
            // Paystack cancellation requires the subscription code and email token
            // We'll mark it locally and the webhook will handle the rest
            const { disableSubscription } = await import('@/lib/paystack')
            try {
                await disableSubscription({
                    code: sub.provider_subscription_id,
                    token: sub.provider_customer_id || '', // email_token stored as customer_id
                })
            } catch (err) {
                console.warn('Paystack disable call failed, marking locally:', err)
            }
        }

        // Mark cancel_at_period_end locally
        const adminSupabase = createSupabaseAdminClient()
        await adminSupabase
            .from('subscriptions')
            .update({
                cancel_at_period_end: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', sub.id)

        return { success: true }
    } catch (err: any) {
        console.error('Cancel subscription error:', err)
        return { success: false, error: err.message }
    }
}

// ─── Get subscription history ───────────────────────────────────────

export async function getSubscriptionHistory(): Promise<{
    success: boolean
    subscriptions: SubscriptionInfo[]
    error?: string
}> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, subscriptions: [], error: 'Not authenticated' }
        }

        const { data, error } = await supabase
            .from('subscriptions')
            .select('id, provider, plan, status, current_period_end, cancel_at_period_end')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10)

        if (error) {
            return { success: false, subscriptions: [], error: error.message }
        }

        return { success: true, subscriptions: (data || []) as SubscriptionInfo[] }
    } catch (err: any) {
        return { success: false, subscriptions: [], error: err.message }
    }
}
