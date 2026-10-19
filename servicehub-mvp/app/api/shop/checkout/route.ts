import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CHECKOUT_ON, canBuyHere } from '@/lib/shop/selling'
import { activeDiscounts, discountedPrice } from '@/lib/shop/discounts'
import { cents, PLATFORM_FEE_PERCENT, stripeClient } from '@/lib/shop/stripe'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HUB = () => (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')

/**
 * POST /api/shop/checkout { vendor }: Stripe's checkout for the cart's items
 * from one vendor (the products round, Goal 9). A direct charge on the
 * vendor's own Stripe account (they are the seller), with ResourceHub's fee
 * (lib/shop/stripe.ts). Prices are read again here, discounts running today
 * included; shipping addresses are in Canada. The order is written when
 * Stripe says it was paid (app/api/shop/stripe-webhook).
 */
export async function POST(req: NextRequest) {
  const stripe = stripeClient()
  if (!CHECKOUT_ON || !stripe) return NextResponse.json({ error: 'Buying through ResourceHub isn’t on yet.' }, { status: 503 })
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const vendor = String(b?.vendor || '')
  if (!UUID.test(vendor)) return NextResponse.json({ error: 'Which seller?' }, { status: 400 })

  const { data: lines } = await supabase.from('cart_items').select('id, product_id, variation, quantity').eq('user_id', user.id)
  const ids = (lines || []).map((l) => l.product_id)
  const { data: products } = ids.length ? await supabase.from('products').select('id, name, price, currency, stock, status, vendor_user_id').in('id', ids) : { data: [] as any[] }
  const byId = new Map((products || []).map((p: any) => [p.id, p]))
  const mine = (lines || []).filter((l) => byId.get(l.product_id)?.vendor_user_id === vendor)
  if (!mine.length) return NextResponse.json({ error: 'Nothing from this seller in your cart.' }, { status: 400 })
  const currencies = new Set(mine.map((l) => byId.get(l.product_id).currency))
  if (currencies.size > 1) return NextResponse.json({ error: 'These are priced in different currencies: check out one at a time.' }, { status: 400 })
  for (const l of mine) {
    const p = byId.get(l.product_id)
    if (!(await canBuyHere(p))) return NextResponse.json({ error: `${p.name} can’t be bought here any more.` }, { status: 400 })
    if (p.stock != null && l.quantity > p.stock) return NextResponse.json({ error: `Only ${p.stock} of ${p.name} left.` }, { status: 400 })
  }
  const { data: acct } = await createAdminClient().from('vendor_payment_accounts').select('stripe_account_id, charges_enabled').eq('user_id', vendor).maybeSingle()
  if (!acct?.charges_enabled) return NextResponse.json({ error: 'This seller can’t take payments just now.' }, { status: 400 })

  const discounts = await activeDiscounts(mine.map((l) => l.product_id))
  const items = mine.map((l) => {
    const p = byId.get(l.product_id)
    const price = discountedPrice(p.price, discounts.get(p.id)) ?? p.price
    const variation = Object.entries(l.variation || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
    return { line: l, p, price, variation }
  })
  const subtotal = items.reduce((s, i) => s + cents(i.price) * i.line.quantity, 0)
  const fee = Math.round((subtotal * PLATFORM_FEE_PERCENT) / 100)
  const hub = HUB() || req.nextUrl.origin
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      customer_email: user.email || undefined,
      line_items: items.map((i) => ({
        quantity: i.line.quantity,
        price_data: {
          currency: String(i.p.currency || 'CAD').toLowerCase(),
          unit_amount: cents(i.price),
          product_data: { name: i.p.name, ...(i.variation ? { description: i.variation } : {}), metadata: { product_id: i.p.id } },
        },
      })),
      shipping_address_collection: { allowed_countries: ['CA'] },
      payment_intent_data: { application_fee_amount: fee, metadata: { kind: 'shop', user_id: user.id, vendor_user_id: vendor } },
      metadata: { kind: 'shop', user_id: user.id, vendor_user_id: vendor, cart_item_ids: mine.map((l) => l.id).join(',') },
      locale: 'auto',
      success_url: `${hub}/orders?done=1`,
      cancel_url: `${hub}/shop/cart`,
    },
    { stripeAccount: acct.stripe_account_id }
  )
  return NextResponse.json({ url: session.url })
}
