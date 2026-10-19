import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { formatMoney, PROMOTION_BUDGETS } from '@/lib/billing'
import { promotionPaymentsReady, stripeClient } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// STEP 83 allows up to $10,000 in all.
const MAX_BUDGET = 1_000_000

/**
 * POST /api/business/promotions/checkout { id, amount_cents, agreed: true }:
 * Stripe's page to pay for a sponsored listing's budget (the Tidbits round's
 * planning note, Goal 7: "priced by click"). Each click spends the bid the
 * owner chose (STEP 83's promotion_record), never more than the budget, and
 * the listing stops when it is spent. The webhook adds the budget once Stripe
 * says it is paid (app/api/stripe/webhook). Only after the owner has seen how
 * it works and agreed, and only once sponsored listings are on, so nobody
 * pays for clicks that can't happen.
 */
export async function POST(req: NextRequest) {
  const stripe = stripeClient()
  if (!stripe || !promotionPaymentsReady()) return NextResponse.json({ error: 'Paying for promotions isn’t set up yet.' }, { status: 503 })
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const amount = Number(b?.amount_cents)
  if (!UUID.test(String(b?.id || '')) || !PROMOTION_BUDGETS.includes(amount)) return NextResponse.json({ error: 'Choose a promotion and an amount.' }, { status: 400 })
  if (b?.agreed !== true) return NextResponse.json({ error: 'Please read how it works and agree first.' }, { status: 400 })
  // Their own promotion (promotions_own_read).
  const { data: promo } = await supabase.from('promotions').select('id, headline, status, budget_cents, bid_cents').eq('id', b.id).eq('user_id', user.id).maybeSingle()
  if (!promo) return NextResponse.json({ error: 'That promotion wasn’t found.' }, { status: 404 })
  if (promo.status === 'rejected') return NextResponse.json({ error: 'The team didn’t approve this promotion.' }, { status: 409 })
  if (!promo.bid_cents) return NextResponse.json({ error: 'Choose what a click is worth first.' }, { status: 400 })
  if ((promo.budget_cents ?? 0) + amount > MAX_BUDGET) return NextResponse.json({ error: 'That would take its budget over $10,000.' }, { status: 400 })

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  const tax = process.env.STRIPE_TAX === 'on'
  const meta = { kind: 'promotion_budget', promotion_id: promo.id, user_id: user.id, amount_cents: String(amount) }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    client_reference_id: user.id,
    customer_email: user.email || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: { currency: 'cad', unit_amount: amount, product_data: { name: 'Sponsored listing budget', description: String(promo.headline).slice(0, 200) } },
      },
    ],
    locale: 'auto',
    ...(tax ? { automatic_tax: { enabled: true }, billing_address_collection: 'required' as const } : {}),
    payment_intent_data: { metadata: meta },
    metadata: meta,
    custom_text: {
      submit: {
        message: `${formatMoney(amount)}${tax ? ' plus tax' : ''}, once. Each click costs ${formatMoney(promo.bid_cents)} until it is spent. Ask us for what is left back at any time.`,
      },
    },
    success_url: `${appUrl}/business?promotion=paid`,
    cancel_url: `${appUrl}/business`,
  })
  return NextResponse.json({ url: session.url })
}
