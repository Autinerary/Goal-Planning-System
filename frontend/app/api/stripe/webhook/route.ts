import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { planForPrice, stripeClient, getPrices } from '@/lib/stripe'
import { planWords, type Plan } from '@/lib/billing'
import { billingFacts, longDate, personFor, sendBillingNotice } from '@/lib/billingNotices'
import { agreementCopyEmail, freePeriodEndingEmail, paymentFailedEmail, planCancelledEmail } from '@/lib/email'
import { TERMS_VERSION } from '@/lib/legal'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Stripe's cancellation reasons, in ours (STEP 81's subscription_feedback).
const REASONS: Record<string, string> = {
  too_expensive: 'too_expensive',
  missing_features: 'missing_features',
  switched_service: 'found_alternative',
  unused: 'not_useful',
  too_complex: 'too_hard',
  low_quality: 'not_useful',
  customer_service: 'other',
  other: 'other',
}

const isoOrNull = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null)

async function userFor(admin: SupabaseClient, sub: Stripe.Subscription, hint?: string | null): Promise<string | null> {
  const fromStripe = (sub.metadata?.user_id as string) || hint || null
  if (fromStripe) return fromStripe
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customer).maybeSingle()
  return data?.user_id || null
}

/** Keeps the person's plan as Stripe has it now (read fresh: Stripe's notices can arrive out of order). */
async function save(admin: SupabaseClient, sub: Stripe.Subscription, userId: string) {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined
  const periodEnd = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end
  const plan = planForPrice(item?.price?.id) || ((sub.metadata?.plan as Plan) ?? null)
  await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      plan: plan === 'monthly' || plan === 'yearly' ? plan : null,
      status: sub.status,
      current_period_end: isoOrNull(periodEnd),
      trial_end: isoOrNull(sub.trial_end),
      cancel_at_period_end: Boolean(sub.cancel_at_period_end || sub.cancel_at),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  return { plan, periodEnd }
}

/**
 * A sponsored listing's budget, paid (app/api/business/promotions/checkout):
 * added to what it had, before tax. One that the team approved and that
 * stopped because its budget ran out shows again. The same payment is never
 * added twice (stripe_events, and the session kept on the promotion).
 */
async function addPromotionBudget(admin: SupabaseClient, s: Stripe.Checkout.Session) {
  const id = s.metadata?.promotion_id
  const amount = s.amount_subtotal ?? Number(s.metadata?.amount_cents || 0)
  if (!id || !amount) return
  const { data: p } = await admin.from('promotions').select('status, budget_cents, spent_cents, reviewed_at, stripe_checkout_session_id').eq('id', id).maybeSingle()
  if (!p || p.stripe_checkout_session_id === s.id) return
  const ranOut = p.status === 'ended' && p.reviewed_at && p.budget_cents != null && p.spent_cents >= p.budget_cents
  const { error } = await admin
    .from('promotions')
    .update({
      budget_cents: Math.min(1_000_000, (p.budget_cents ?? 0) + amount),
      paid_at: new Date().toISOString(),
      stripe_checkout_session_id: s.id,
      updated_at: new Date().toISOString(),
      ...(ranOut ? { status: 'active' } : {}),
    })
    .eq('id', id)
  if (error) throw new Error(`promotion budget: ${error.message}`)
}

/**
 * POST /api/stripe/webhook: Stripe's notices about plans, checked with
 * STRIPE_WEBHOOK_SECRET (docs/subscriptions-2026-10.md):
 *
 * - every change to a plan is kept in subscriptions (STEP 81), read fresh
 *   from Stripe each time;
 * - after subscribing: a copy of the agreement (Ontario, O. Reg. 17/05 s. 33);
 * - three days before a free period becomes paid: the end date and price
 *   (Quebec, s. 187.29: 2 to 10 days before);
 * - a payment that failed, and a cancellation, each by email;
 * - Stripe's cancellation reason, as feedback;
 * - a sponsored listing's budget, once it is paid.
 *
 * Each notice is handled once (stripe_events), and each email sent once
 * (billing_notices), however often Stripe repeats itself.
 */
export async function POST(req: NextRequest) {
  const stripe = stripeClient()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) return NextResponse.json({ error: 'not set up' }, { status: 503 })
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers.get('stripe-signature') || '', secret)
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data: seen } = await admin.from('stripe_events').select('id').eq('id', event.id).maybeSingle()
  if (seen) return NextResponse.json({ received: true, repeat: true })

  const facts = billingFacts()
  const subscriptionId = (s: string | Stripe.Subscription | null | undefined) => (typeof s === 'string' ? s : s?.id || null)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        if (s.mode === 'payment' && s.metadata?.kind === 'promotion_budget') {
          if (s.payment_status === 'paid') await addPromotionBudget(admin, s)
          break
        }
        const id = subscriptionId(s.subscription as string | Stripe.Subscription | null)
        if (s.mode !== 'subscription' || !id) break
        const sub = await stripe.subscriptions.retrieve(id)
        const userId = await userFor(admin, sub, s.client_reference_id)
        if (!userId) break
        const { plan } = await save(admin, sub, userId)
        const prices = await getPrices()
        const who = await personFor(admin, userId)
        if (plan === 'monthly' || plan === 'yearly') {
          const firstCharge = sub.status === 'trialing' && sub.trial_end ? `${longDate(sub.trial_end * 1000)}, when your free month ends` : `today, ${longDate(Date.now())}`
          await sendBillingNotice(admin, {
            userId,
            kind: 'agreement_copy',
            ref: sub.id,
            to: who.email,
            email: agreementCopyEmail(facts, {
              name: who.name,
              date: longDate(Date.now()),
              planWords: planWords(plan),
              price: prices?.[plan]?.label || 'the price shown when you subscribed',
              firstCharge,
              taxes: process.env.STRIPE_TAX === 'on',
              termsUrl: `${facts.appUrl}/terms#paid-plans (version ${(sub.metadata?.terms_version as string) || TERMS_VERSION})`,
            }),
          })
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
      case 'customer.subscription.trial_will_end': {
        const sub = await stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id)
        const userId = await userFor(admin, sub)
        if (!userId) break
        const { plan, periodEnd } = await save(admin, sub, userId)
        const who = await personFor(admin, userId)
        if (event.type === 'customer.subscription.trial_will_end' && sub.status === 'trialing' && sub.trial_end && !sub.cancel_at_period_end && (plan === 'monthly' || plan === 'yearly')) {
          const prices = await getPrices()
          await sendBillingNotice(admin, {
            userId,
            kind: 'free_period_ending',
            ref: `${sub.id}:${sub.trial_end}`,
            to: who.email,
            email: freePeriodEndingEmail(facts, { ends: longDate(sub.trial_end * 1000), price: prices?.[plan]?.label || 'your plan’s price', planWords: planWords(plan) }),
          })
        }
        const ending = sub.status === 'canceled' || sub.cancel_at_period_end || Boolean(sub.cancel_at)
        if (ending) {
          await sendBillingNotice(admin, {
            userId,
            kind: 'cancelled',
            ref: sub.id,
            to: who.email,
            email: planCancelledEmail(facts, { until: sub.status === 'canceled' ? null : longDate(((sub.cancel_at as number | null) || periodEnd || 0) * 1000) }),
          })
          const why = sub.cancellation_details
          if (why && (why.feedback || why.comment)) {
            await admin.from('subscription_feedback').upsert(
              {
                user_id: userId,
                moment: 'stripe',
                reason: why.feedback ? REASONS[why.feedback] || 'other' : null,
                details: why.comment ? String(why.comment).slice(0, 2000) : null,
                stripe_subscription_id: sub.id,
              },
              { onConflict: 'stripe_subscription_id', ignoreDuplicates: true }
            )
          }
        }
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null; parent?: { subscription_details?: { subscription?: string | Stripe.Subscription } } }
        const id = subscriptionId(invoice.parent?.subscription_details?.subscription || invoice.subscription || null)
        if (!id) break
        const sub = await stripe.subscriptions.retrieve(id)
        const userId = await userFor(admin, sub)
        if (!userId) break
        await save(admin, sub, userId)
        if (event.type === 'invoice.payment_failed') {
          const who = await personFor(admin, userId)
          await sendBillingNotice(admin, { userId, kind: 'payment_failed', ref: invoice.id || event.id, to: who.email, email: paymentFailedEmail(facts) })
        }
        break
      }
    }
  } catch (e: any) {
    console.error('[stripe] webhook failed:', event.type, e?.message)
    // Not marked as handled, so Stripe sends it again.
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
  await admin.from('stripe_events').upsert({ id: event.id, type: event.type }, { onConflict: 'id', ignoreDuplicates: true })
  return NextResponse.json({ received: true })
}
