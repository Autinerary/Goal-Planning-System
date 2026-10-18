import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cronAuthorized } from '@/lib/cronAuth'
import { PAYWALL_ON, PAYMENTS_ON, planWords } from '@/lib/billing'
import { emailEnabled, freeMonthEndedEmail, freeMonthEndingEmail, freePeriodEndingEmail, renewalNoticeEmail } from '@/lib/email'
import { billingFacts, longDate, personFor, sendBillingNotice } from '@/lib/billingNotices'
import { getPrices } from '@/lib/stripe'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const DAY = 86_400_000
const LIMIT = 300

/**
 * GET /api/cron/billing-notices, once a day (vercel.json): the billing emails
 * that come from dates, not from Stripe (docs/subscriptions-2026-10.md):
 *
 * - three days before someone's free month ends, and just after, with the one
 *   question about why they didn't continue (only with the paywall on, and
 *   only for people with no plan and no free access);
 * - 60 to 75 days before a yearly plan renews (Ontario, O. Reg. 17/05 s. 42:
 *   30 to 90 days);
 * - a free period ending for someone who subscribed during their free month,
 *   if Stripe's own notice (the webhook) hasn't sent it.
 *
 * Each is sent once (billing_notices). Nothing without RESEND_API_KEY.
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PAYMENTS_ON || !emailEnabled()) return NextResponse.json({ skipped: 'billing or email is off' })
  const admin = createAdminClient()
  const facts = billingFacts()
  const now = Date.now()
  const out: Record<string, number> = {}
  const count = (k: string) => (out[k] = (out[k] || 0) + 1)

  // People with a plan or free access don't need the free month's emails.
  const covered = async (ids: string[]) => {
    if (!ids.length) return new Set<string>()
    const [{ data: subs }, { data: grants }] = await Promise.all([
      admin.from('subscriptions').select('user_id').in('user_id', ids).in('status', ['active', 'trialing', 'past_due', 'paused']),
      admin.from('access_grants').select('user_id, ends_at').in('user_id', ids).eq('status', 'active'),
    ])
    return new Set([...(subs || []).map((s) => s.user_id), ...(grants || []).filter((g) => !g.ends_at || Date.parse(g.ends_at) > now).map((g) => g.user_id)])
  }

  if (PAYWALL_ON) {
    const { data: ending } = await admin
      .from('access_trials')
      .select('user_id, ends_at')
      .gte('ends_at', new Date(now + 2 * DAY).toISOString())
      .lt('ends_at', new Date(now + 4 * DAY).toISOString())
      .limit(LIMIT)
    const endingCovered = await covered((ending || []).map((t) => t.user_id))
    for (const t of ending || []) {
      if (endingCovered.has(t.user_id)) continue
      const who = await personFor(admin, t.user_id)
      count(await sendBillingNotice(admin, { userId: t.user_id, kind: 'free_month_ending', ref: `${t.user_id}:${t.ends_at.slice(0, 10)}`, to: who.email, email: freeMonthEndingEmail(facts, { ends: longDate(t.ends_at) }) }))
    }

    const { data: ended } = await admin
      .from('access_trials')
      .select('user_id, ends_at')
      .gte('ends_at', new Date(now - 3 * DAY).toISOString())
      .lt('ends_at', new Date(now).toISOString())
      .limit(LIMIT)
    const endedCovered = await covered((ended || []).map((t) => t.user_id))
    for (const t of ended || []) {
      if (endedCovered.has(t.user_id)) continue
      const who = await personFor(admin, t.user_id)
      count(await sendBillingNotice(admin, { userId: t.user_id, kind: 'free_month_ended', ref: `${t.user_id}:${t.ends_at.slice(0, 10)}`, to: who.email, email: freeMonthEndedEmail(facts) }))
    }
  }

  const prices = await getPrices()

  const { data: renewing } = await admin
    .from('subscriptions')
    .select('user_id, stripe_subscription_id, current_period_end')
    .eq('plan', 'yearly')
    .eq('status', 'active')
    .eq('cancel_at_period_end', false)
    .gte('current_period_end', new Date(now + 60 * DAY).toISOString())
    .lt('current_period_end', new Date(now + 75 * DAY).toISOString())
    .limit(LIMIT)
  for (const s of renewing || []) {
    if (!s.stripe_subscription_id || !s.current_period_end) continue
    const who = await personFor(admin, s.user_id)
    count(
      await sendBillingNotice(admin, {
        userId: s.user_id,
        kind: 'renewal_notice',
        ref: `${s.stripe_subscription_id}:${s.current_period_end.slice(0, 10)}`,
        to: who.email,
        email: renewalNoticeEmail(facts, { renews: longDate(s.current_period_end), price: prices?.yearly.label || 'your plan’s price' }),
      })
    )
  }

  const { data: trialing } = await admin
    .from('subscriptions')
    .select('user_id, stripe_subscription_id, plan, trial_end')
    .eq('status', 'trialing')
    .eq('cancel_at_period_end', false)
    .gte('trial_end', new Date(now + 2 * DAY).toISOString())
    .lt('trial_end', new Date(now + 9 * DAY).toISOString())
    .limit(LIMIT)
  for (const s of trialing || []) {
    if (!s.stripe_subscription_id || !s.trial_end || (s.plan !== 'monthly' && s.plan !== 'yearly')) continue
    const who = await personFor(admin, s.user_id)
    count(
      await sendBillingNotice(admin, {
        userId: s.user_id,
        kind: 'free_period_ending',
        ref: `${s.stripe_subscription_id}:${Math.floor(Date.parse(s.trial_end) / 1000)}`,
        to: who.email,
        email: freePeriodEndingEmail(facts, { ends: longDate(s.trial_end), price: prices?.[s.plan as 'monthly' | 'yearly']?.label || 'your plan’s price', planWords: planWords(s.plan) }),
      })
    )
  }

  console.log('[billing-notices]', JSON.stringify(out))
  return NextResponse.json(out)
}

export const POST = GET
