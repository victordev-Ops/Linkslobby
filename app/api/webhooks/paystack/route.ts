// Paystack Webhook Handler
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, verifyTransaction } from '@/lib/paystack'
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

                // Paystack does not reliably echo transaction-level metadata onto
                // the subscription object here — when it's missing, charge.success
                // (which fires alongside this event and DOES carry metadata) is the
                // source of truth, so just skip quietly rather than erroring.
                if (!userId || !plan) {
                    console.warn('subscription.create missing metadata — deferring to charge.success', data.subscription_code)
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

            // ─── FIXED ───────────────────────────────────────────────────
            // Previously this branch trusted `data.plan_object` /
            // `data.subscription_code` directly off the webhook body. The
            // charge.success webhook payload does not reliably use those
            // field names (those come from the /transaction/verify API
            // response shape) — so the condition was silently false and
            // is_pro never got flipped, even though the event was logged
            // as "processed" in webhook_events.
            //
            // Fix: treat the webhook as a "something happened, go check"
            // signal, and pull the authoritative data from
            // verifyTransaction() (a shape we control and already trust
            // elsewhere in the codebase), instead of parsing the raw
            // webhook body for subscription fields.
            case 'charge.success': {
                const data = event.data
                const userId = data.metadata?.user_id
                const planFromMetadata = data.metadata?.plan as string | undefined

                if (!userId) {
                    console.error('charge.success missing user_id in metadata for reference', data.reference)
                    break
                }

                let verified
                try {
                    verified = await verifyTransaction(data.reference)
                } catch (err) {
                    console.error('Failed to verify Paystack transaction on charge.success:', err)
                    break
                }

                if (verified.status !== 'success') {
                    console.warn('charge.success webhook but verify shows status:', verified.status)
                    break
                }

                const subCode = verified.subscription_code
                const planObject = verified.plan_object

                if (subCode) {
                    const plan = planFromMetadata || (planObject ? mapPaystackInterval(planObject.interval) : 'monthly')

                    const { error } = await supabase
                        .from('subscriptions')
                        .upsert({
                            user_id: userId,
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

                    if (error) console.error('Failed to update Paystack subscription on charge:', error)
                } else {
                    // A successful charge with no subscription attached (e.g. a
                    // one-off payment). Nothing to link to `subscriptions`, but
                    // still worth a log in case a plan charge is unexpectedly
                    // missing a subscription_code.
                    console.warn('charge.success verified but no subscription_code present for user', userId)
                }

                // Always resync — covers the case where the subscription row
                // already existed (e.g. subscription.create got there first).
                await supabase.rpc('sync_pro_status', { target_user_id: userId })
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
