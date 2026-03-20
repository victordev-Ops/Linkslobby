// Paystack Webhook Handler
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/paystack'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    const body = await req.text()
    const signature = req.headers.get('x-paystack-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)
    const supabase = createSupabaseAdminClient()

    // Idempotency: check if this event was already processed
    const eventId = event.data?.id || event.data?.reference || `paystack_${Date.now()}`
    const { data: existing } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('id', eventId)
        .maybeSingle()

    if (existing) {
        return NextResponse.json({ received: true, message: 'Already processed' })
    }

    // Log the event as processed
    await supabase.from('webhook_events').insert({
        id: eventId,
        provider: 'paystack',
        event_type: event.event,
    })

    try {
        switch (event.event) {
            case 'subscription.create': {
                const data = event.data
                const userId = data.metadata?.user_id
                const plan = data.metadata?.plan as string

                if (!userId || !plan) {
                    console.error('Missing user_id or plan in Paystack subscription metadata')
                    break
                }

                const { error } = await supabase
                    .from('subscriptions')
                    .upsert({
                        user_id: userId,
                        provider: 'paystack',
                        provider_subscription_id: data.subscription_code,
                        provider_customer_id: data.customer?.customer_code,
                        plan,
                        status: 'active',
                        current_period_start: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
                        current_period_end: data.next_payment_date ? new Date(data.next_payment_date).toISOString() : null,
                        cancel_at_period_end: false,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'provider,provider_subscription_id' })

                if (error) {
                    console.error('Failed to upsert Paystack subscription:', error)
                    break
                }

                await supabase.rpc('sync_pro_status', { target_user_id: userId })
                break
            }

            case 'subscription.disable':
            case 'subscription.expiring_cards': {
                const data = event.data
                const subCode = data.subscription_code

                const { data: existing } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('provider', 'paystack')
                    .eq('provider_subscription_id', subCode)
                    .single()

                if (!existing) break

                const status = event.event === 'subscription.disable' ? 'cancelled' : 'active'

                await supabase
                    .from('subscriptions')
                    .update({
                        status,
                        cancel_at_period_end: event.event === 'subscription.disable',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('provider', 'paystack')
                    .eq('provider_subscription_id', subCode)

                await supabase.rpc('sync_pro_status', { target_user_id: existing.user_id })
                break
            }

            case 'subscription.not_renew': {
                const data = event.data
                const subCode = data.subscription_code

                const { data: existing } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('provider', 'paystack')
                    .eq('provider_subscription_id', subCode)
                    .single()

                if (!existing) break

                await supabase
                    .from('subscriptions')
                    .update({
                        cancel_at_period_end: true,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('provider', 'paystack')
                    .eq('provider_subscription_id', subCode)

                break
            }

            case 'charge.success': {
                const data = event.data
                const userId = data.metadata?.user_id
                const plan = data.metadata?.plan as string

                // If this is a subscription charge, update period
                if (data.plan_object && userId) {
                    const subCode = data.subscription_code

                    if (subCode) {
                        const { error } = await supabase
                            .from('subscriptions')
                            .upsert({
                                user_id: userId,
                                provider: 'paystack',
                                provider_subscription_id: subCode,
                                provider_customer_id: data.customer?.customer_code,
                                plan: plan || mapPaystackInterval(data.plan_object.interval),
                                status: 'active',
                                current_period_start: new Date().toISOString(),
                                current_period_end: calculateNextPeriod(data.plan_object.interval),
                                cancel_at_period_end: false,
                                updated_at: new Date().toISOString(),
                            }, { onConflict: 'provider,provider_subscription_id' })

                        if (error) console.error('Failed to update Paystack subscription on charge:', error)
                        await supabase.rpc('sync_pro_status', { target_user_id: userId })
                    }
                }
                break
            }

            case 'invoice.payment_failed': {
                const data = event.data
                const subCode = data.subscription?.subscription_code

                if (!subCode) break

                const { data: existing } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('provider', 'paystack')
                    .eq('provider_subscription_id', subCode)
                    .single()

                if (!existing) break

                await supabase
                    .from('subscriptions')
                    .update({
                        status: 'past_due',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('provider', 'paystack')
                    .eq('provider_subscription_id', subCode)

                await supabase.rpc('sync_pro_status', { target_user_id: existing.user_id })
                break
            }
        }

        return NextResponse.json({ received: true })
    } catch (err: any) {
        console.error('Paystack webhook processing error:', err)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}

function mapPaystackInterval(interval: string): string {
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
