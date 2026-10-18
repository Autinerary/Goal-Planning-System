import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlan, PAYMENTS_ON, planWords } from '@/lib/billing'
import { getPrices, paymentsReady, priceFor, stripeClient } from '@/lib/stripe'
import { longDate } from '@/lib/billingNotices'
import { TERMS_VERSION } from '@/lib/legal'

export const dynamic = 'force-dynamic'

const HOURS_49 = 49 * 3_600_000

/**
 * POST /api/billing/checkout { plan: 'monthly' | 'yearly', agreed: true }:
 * Stripe's page to subscribe (docs/subscriptions-2026-10.md).
 *
 * - Only after the person has seen the price and terms and agreed (the
 *   billing page; Ontario's CPA s. 38: a chance to accept or decline
 *   immediately before).
 * - Nothing is charged in the free month: someone who subscribes during it is
 *   first charged when it ends (at least two days ahead, Stripe's minimum).
 * - The price Stripe shows is the price: no added fees, tax shown separately.
 */
export async function POST(req: NextRequest) {
  const stripe = stripeClient()
  if (!PAYMENTS_ON || !stripe || !paymentsReady()) return NextResponse.json({ error: 'Paying isn’t set up yet.' }, { status: 503 })
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (!isPlan(body?.plan)) return NextResponse.json({ error: 'Choose monthly or yearly.' }, { status: 400 })
  if (body?.agreed !== true) return NextResponse.json({ error: 'Please read and agree to the terms first.' }, { status: 400 })
  const price = priceFor(body.plan)
  const prices = await getPrices()
  if (!price || !prices) return NextResponse.json({ error: 'That plan isn’t set up yet.' }, { status: 503 })

  const admin = createAdminClient()
  const { data: existing } = await admin.from('subscriptions').select('stripe_customer_id, status').eq('user_id', user.id).maybeSingle()
  if (existing && ['active', 'trialing', 'past_due', 'paused'].includes(existing.status)) {
    return NextResponse.json({ error: 'You already have a plan: change it from Billing.' }, { status: 409 })
  }

  // The free month: everyone has one, and it is never charged.
  let { data: trial } = await admin.from('access_trials').select('ends_at').eq('user_id', user.id).maybeSingle()
  if (!trial) {
    const ends = new Date(Date.now() + 30 * 86_400_000).toISOString()
    await admin.from('access_trials').upsert({ user_id: user.id, ends_at: ends }, { onConflict: 'user_id', ignoreDuplicates: true })
    trial = (await admin.from('access_trials').select('ends_at').eq('user_id', user.id).maybeSingle()).data
  }
  const trialEnds = trial?.ends_at ? Date.parse(trial.ends_at) : 0
  const freeLeft = trialEnds > Date.now()
  const firstCharge = freeLeft ? Math.max(trialEnds, Date.now() + HOURS_49) : 0

  let customer = existing?.stripe_customer_id || null
  if (!customer) {
    const made = await stripe.customers.create({ email: user.email || undefined, metadata: { user_id: user.id } })
    customer = made.id
    await admin.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customer, status: existing?.status || 'none', updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  const label = prices[body.plan as 'monthly' | 'yearly'].label
  const tax = process.env.STRIPE_TAX === 'on'
  const recap = freeLeft
    ? `Nothing is charged today. From ${longDate(firstCharge)}, when your free month ends: ${label} ${planWords(body.plan)}${tax ? ' plus tax' : ''}, until you cancel. We email you before then. Cancel any time in Billing.`
    : `${label} ${planWords(body.plan)}${tax ? ' plus tax' : ''}, from today, until you cancel. Cancel any time in Billing.`

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    locale: 'auto',
    allow_promotion_codes: true,
    ...(tax ? { automatic_tax: { enabled: true }, billing_address_collection: 'required' as const, customer_update: { address: 'auto' as const, name: 'auto' as const } } : {}),
    subscription_data: {
      metadata: { user_id: user.id, plan: body.plan, terms_version: TERMS_VERSION, agreed_at: new Date().toISOString() },
      ...(freeLeft ? { trial_end: Math.floor(firstCharge / 1000), trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } } } : {}),
    },
    metadata: { user_id: user.id, plan: body.plan },
    custom_text: { submit: { message: recap } },
    success_url: `${appUrl}/billing?done=1`,
    cancel_url: `${appUrl}/billing?plan=${body.plan}`,
  })
  return NextResponse.json({ url: session.url })
}
