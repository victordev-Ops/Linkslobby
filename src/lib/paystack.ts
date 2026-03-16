// src/lib/paystack.ts — Paystack API helper (fetch-based, no SDK)
import crypto from 'crypto'

const PAYSTACK_SECRET = () => {
    const key = process.env.PAYSTACK_SECRET_KEY
    if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set')
    return key
}

const BASE_URL = 'https://api.paystack.co'

// Plan codes — set these in .env.local after creating plans in Paystack Dashboard
export const PAYSTACK_PLANS = {
    weekly: process.env.PAYSTACK_PLAN_WEEKLY!,
    monthly: process.env.PAYSTACK_PLAN_MONTHLY!,
    annual: process.env.PAYSTACK_PLAN_ANNUAL!,
} as const

export type PaystackPlan = keyof typeof PAYSTACK_PLANS

async function paystackFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET()}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    })
    const data = await res.json()
    if (!data.status) {
        throw new Error(data.message || 'Paystack API error')
    }
    return data.data as T
}

// Initialize a transaction (one-time or subscription)
export async function initializeTransaction(params: {
    email: string
    amount: number      // in kobo (NGN) or cents (USD)
    currency?: string   // defaults to NGN for Paystack accounts based in Nigeria
    plan?: string       // Paystack plan code for recurring
    metadata?: Record<string, any>
    callback_url?: string
}) {
    return paystackFetch<{ authorization_url: string; access_code: string; reference: string }>(
        '/transaction/initialize',
        { method: 'POST', body: JSON.stringify(params) }
    )
}

// Create a subscription directly
export async function createSubscription(params: {
    customer: string    // customer code or email
    plan: string        // plan code
    start_date?: string
}) {
    return paystackFetch<{ subscription_code: string; email_token: string }>(
        '/subscription',
        { method: 'POST', body: JSON.stringify(params) }
    )
}

// Disable (cancel) a subscription
export async function disableSubscription(params: {
    code: string
    token: string
}) {
    return paystackFetch<any>(
        '/subscription/disable',
        { method: 'POST', body: JSON.stringify(params) }
    )
}

// Verify a transaction
export async function verifyTransaction(reference: string) {
    return paystackFetch<{
        status: string
        reference: string
        amount: number
        customer: { email: string; customer_code: string }
        plan_object?: { plan_code: string; name: string; interval: string }
        subscription_code?: string
    }>(`/transaction/verify/${reference}`)
}

// Verify webhook signature
export function verifyWebhookSignature(body: string, signature: string): boolean {
    const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET())
        .update(body)
        .digest('hex')
    return hash === signature
}
