// Stripe Webhook Handler
import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')

    if (!sig) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is not configured')
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    let event
    try {
        const stripe = getStripe()
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err: any) {
        console.error('Stripe webhook signature verification failed:', err.message)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const supabase = createSupabaseAdminClient()

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object
                const userId = session.metadata?.user_id
                const plan = session.metadata?.plan as string

                if (!userId || !plan) {
                    console.error('Missing user_id or plan in checkout session metadata')
                    break
                }

                // Get the subscription ID from the session
                const subscriptionId = session.subscription as string
                if (!subscriptionId) break

                const stripe = getStripe()
                const subscription = await stripe.subscriptions.retrieve(subscriptionId)

                // Upsert subscription record
                const { error } = await supabase
                    .from('subscriptions')
                    .upsert({
                        user_id: userId,
                        provider: 'stripe',
                        provider_subscription_id: subscriptionId,
                        provider_customer_id: session.customer as string,
                        plan,
                        status: 'active',
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        cancel_at_period_end: subscription.cancel_at_period_end,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'provider,provider_subscription_id' })

                if (error) {
                    console.error('Failed to upsert subscription:', error)
                    break
                }

                // Sync is_pro status
                await supabase.rpc('sync_pro_status', { target_user_id: userId })
                break
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object
                const subId = subscription.id

                // Find the existing subscription record
                const { data: existing } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('provider', 'stripe')
                    .eq('provider_subscription_id', subId)
                    .single()

                if (!existing) {
                    console.warn('No subscription record found for Stripe sub:', subId)
                    break
                }

                const statusMap: Record<string, string> = {
                    active: 'active',
                    past_due: 'past_due',
                    canceled: 'cancelled',
                    unpaid: 'past_due',
                    trialing: 'trialing',
                    incomplete: 'past_due',
                    incomplete_expired: 'expired',
                }

                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        status: statusMap[subscription.status] || 'active',
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        cancel_at_period_end: subscription.cancel_at_period_end,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('provider', 'stripe')
                    .eq('provider_subscription_id', subId)

                if (error) console.error('Failed to update subscription:', error)

                await supabase.rpc('sync_pro_status', { target_user_id: existing.user_id })
                break
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object
                const subId = subscription.id

                const { data: existing } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('provider', 'stripe')
                    .eq('provider_subscription_id', subId)
                    .single()

                if (!existing) break

                await supabase
                    .from('subscriptions')
                    .update({
                        status: 'expired',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('provider', 'stripe')
                    .eq('provider_subscription_id', subId)

                await supabase.rpc('sync_pro_status', { target_user_id: existing.user_id })
                break
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object
                const subId = invoice.subscription as string
                if (!subId) break

                const { data: existing } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('provider', 'stripe')
                    .eq('provider_subscription_id', subId)
                    .single()

                if (!existing) break

                await supabase
                    .from('subscriptions')
                    .update({
                        status: 'past_due',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('provider', 'stripe')
                    .eq('provider_subscription_id', subId)

                await supabase.rpc('sync_pro_status', { target_user_id: existing.user_id })
                break
            }
        }

        return NextResponse.json({ received: true })
    } catch (err: any) {
        console.error('Stripe webhook processing error:', err)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}
