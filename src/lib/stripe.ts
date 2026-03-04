// src/lib/stripe.ts — Stripe SDK singleton
import Stripe from 'stripe'

let stripeInstance: Stripe | undefined

export function getStripe(): Stripe {
    if (!stripeInstance) {
        const key = process.env.STRIPE_SECRET_KEY
        if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
        stripeInstance = new Stripe(key, { apiVersion: '2026-02-25.clover' })
    }
    return stripeInstance
}

// Price IDs — set these in .env.local after creating products in Stripe Dashboard
export const STRIPE_PRICES = {
    weekly: process.env.STRIPE_PRICE_WEEKLY!,
    monthly: process.env.STRIPE_PRICE_MONTHLY!,
    annual: process.env.STRIPE_PRICE_ANNUAL!,
} as const

export type StripePlan = keyof typeof STRIPE_PRICES
