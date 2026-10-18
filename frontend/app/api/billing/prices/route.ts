import { NextResponse } from 'next/server'
import { PAYMENTS_ON, PAYWALL_ON } from '@/lib/billing'
import { getPrices, paymentsReady } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/** GET /api/billing/prices: the plans' prices from Stripe, and whether paying is on (lib/billing.ts). */
export async function GET() {
  const ready = PAYMENTS_ON && paymentsReady()
  const prices = ready ? await getPrices() : null
  return NextResponse.json({ payments: Boolean(ready && prices), paywall: PAYWALL_ON, prices, tax: process.env.STRIPE_TAX === 'on' })
}
