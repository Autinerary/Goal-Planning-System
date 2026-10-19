import Stripe from 'stripe'
import { businessReady, formatMoney, type Plan, type Prices } from '@/lib/billing'

/** Stripe, when it is set up (lib/billing.ts); null before. Server only. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new Stripe(key) : null
}

export function priceFor(plan: Plan): string | null {
  return (plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY) || null
}

export function planForPrice(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly'
  if (priceId === process.env.STRIPE_PRICE_YEARLY) return 'yearly'
  return null
}

/** Stripe, both prices, and the business details the law asks to show before anyone pays. */
export const paymentsReady = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && priceFor('monthly') && priceFor('yearly') && businessReady())

/**
 * A listing's owner can pay for a sponsored listing's budget (STEP 83;
 * app/api/business/promotions/checkout): Stripe, the business details, and
 * sponsored listings turned on, so nobody pays for clicks that can't happen.
 */
export const promotionPaymentsReady = () =>
  Boolean(process.env.NEXT_PUBLIC_SPONSORED === 'on' && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && businessReady())

let cached: { at: number; prices: Prices | null } | null = null

/**
 * The prices, read from Stripe so what is shown is what is charged (the
 * Competition Act: a price shown must be one people can pay). Kept ten
 * minutes per server.
 */
export async function getPrices(): Promise<Prices | null> {
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.prices
  const stripe = stripeClient()
  const ids = [priceFor('monthly'), priceFor('yearly')]
  if (!stripe || !ids[0] || !ids[1]) return null
  try {
    const [m, y] = await Promise.all(ids.map((id) => stripe.prices.retrieve(id as string)))
    if (m.unit_amount == null || y.unit_amount == null) throw new Error('a price has no amount')
    const saves = m.unit_amount > 0 ? Math.floor((1 - y.unit_amount / (12 * m.unit_amount)) * 100) : 0
    const prices: Prices = {
      monthly: { amount: m.unit_amount, currency: m.currency, label: formatMoney(m.unit_amount, m.currency) },
      yearly: { amount: y.unit_amount, currency: y.currency, label: formatMoney(y.unit_amount, y.currency) },
      yearlySaves: saves > 0 ? `${saves}%` : null,
    }
    cached = { at: Date.now(), prices }
    return prices
  } catch (e: any) {
    console.error('[stripe] prices:', e?.message)
    return null
  }
}
