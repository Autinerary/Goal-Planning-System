import Stripe from 'stripe'

/**
 * Stripe for the shop (the products round's planning note, Goal 9), through
 * Stripe Connect: each vendor has their own Stripe account and is the seller;
 * ResourceHub takes a small fee from each sale (SHOP_PLATFORM_FEE_PERCENT,
 * 8% unless the team sets it; docs/products-round-2026-10.md weighs the
 * revenue options). Off until NEXT_PUBLIC_SHOP_CHECKOUT=on. Server only.
 */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new Stripe(key) : null
}

export const PLATFORM_FEE_PERCENT = Math.min(30, Math.max(0, Number(process.env.SHOP_PLATFORM_FEE_PERCENT ?? 8) || 0))

export const cents = (amount: number) => Math.round(amount * 100)
