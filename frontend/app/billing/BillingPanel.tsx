'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/contact'
import { useSearchParams } from 'next/navigation'
import { BUSINESS, isPlan, PAYMENTS_ON, planWords, type Plan, type Prices } from '@/lib/billing'
import HelpMakeItFree from '../components/HelpMakeItFree'
import WhyNotContinue from '../components/WhyNotContinue'

interface Access {
  access: boolean
  reason: 'team' | 'grant' | 'subscription' | 'trial' | 'trial_over' | 'none' | 'open' | 'signed_out'
  paywall?: boolean
  kind?: string
  ends_at?: string | null
  plan?: Plan | null
  status?: string
  renews?: boolean
  period_end?: string | null
  trial_end?: string | null
  trial_ends_at?: string | null
  days_left?: number
  pending?: boolean
  subscription?: { plan: Plan | null; status: string; current_period_end: string | null; trial_end: string | null; cancel_at_period_end: boolean } | null
}

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Toronto' }) : ''

const GRANT_WORDS: Record<string, string> = {
  student: 'as a student',
  employee: 'through your workplace',
  government: 'through your government or city',
  advocate: 'because you help advocate for it',
  partner: 'through a partner',
  team: 'as part of the team',
}

/**
 * Billing: where someone stands (the team, free access, a plan, the free
 * month), choosing a plan with everything shown first and an explicit "I
 * agree", changing or cancelling it (a plain "Cancel my plan" button), and
 * the one question for people who don't continue (docs/subscriptions-2026-10.md).
 */
export default function BillingPanel() {
  const params = useSearchParams()
  const [access, setAccess] = useState<Access | null>(null)
  const [prices, setPrices] = useState<{ payments: boolean; prices: Prices | null; tax: boolean } | null>(null)
  const [plan, setPlan] = useState<Plan>(isPlan(params.get('plan')) ? (params.get('plan') as Plan) : 'yearly')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const done = params.get('done') === '1'
  const cancelled = params.get('cancelled') === '1'
  const askWhy = params.get('why') === '1'

  const load = useCallback(
    () =>
      fetch('/api/me/access', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Access | null) => {
          if (d) setAccess(d)
          return d
        })
        .catch(() => null),
    []
  )

  useEffect(() => {
    void load()
    fetch('/api/billing/prices', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPrices(d))
      .catch(() => {})
  }, [load])

  // Back from Stripe: the plan arrives a moment later, through Stripe's notice.
  useEffect(() => {
    if (!done) return
    let tries = 0
    const id = setInterval(async () => {
      tries += 1
      const d = await load()
      if ((d && d.reason === 'subscription') || tries >= 6) clearInterval(id)
    }, 2500)
    return () => clearInterval(id)
  }, [done, load])

  const go = async (path: string, body: object, what: string) => {
    setBusy(what)
    setError('')
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    if (res?.ok && d?.url) {
      window.location.href = d.url
      return
    }
    setBusy('')
    setError(d?.error || 'That didn’t work just now. Please try again.')
  }

  const p = prices?.prices
  const canChoose = Boolean(PAYMENTS_ON && prices?.payments && p)
  const sub = access?.subscription || null
  const hasPlan = Boolean(sub && sub.status !== 'canceled' && sub.status !== 'incomplete_expired')
  const inFreeMonth = access?.reason === 'trial'
  const tax = prices?.tax ? ' plus tax' : ''
  // As the checkout does it: a free month first (from today, if it hasn't started), never charged, and at least two days ahead.
  const freeFirst = access?.reason !== 'trial_over'
  const firstChargeAt = inFreeMonth && access?.trial_ends_at ? Math.max(Date.parse(access.trial_ends_at), Date.now() + 49 * 3_600_000) : Date.now() + 30 * 86_400_000
  const firstCharge = freeFirst ? `on ${day(new Date(firstChargeAt).toISOString())}, when your free month ends` : 'today'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-sm font-semibold text-indigo-800">Autinerary</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Billing</h1>

      {done && (
        <p role="status" className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-slate-900">
          Thank you! {access?.reason === 'subscription' ? 'Your plan is set up.' : 'Your plan is being set up; this page updates in a moment.'} We have
          emailed you a copy of your agreement.
        </p>
      )}
      {cancelled && (
        <p role="status" className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-4 text-slate-900">
          Your plan is cancelled. You won&apos;t be charged again.
        </p>
      )}

      <section aria-labelledby="where" className="mt-6 rounded-xl border border-slate-200 p-5">
        <h2 id="where" className="text-lg font-semibold text-slate-900">
          Where you are
        </h2>
        {!access ? (
          <p className="mt-2 text-slate-700">Looking…</p>
        ) : access.paywall === false ? (
          <p className="mt-2 text-slate-800">Autinerary is free during the beta. There is nothing to pay.</p>
        ) : access.reason === 'team' ? (
          <p className="mt-2 text-slate-800">You&apos;re on the team, so you have full access.</p>
        ) : access.reason === 'grant' ? (
          <p className="mt-2 text-slate-800">
            You have free access {GRANT_WORDS[access.kind || ''] || ''}
            {access.ends_at ? `, until ${day(access.ends_at)}` : ''}.
          </p>
        ) : access.reason === 'subscription' ? (
          <p className="mt-2 text-slate-800">You have a paid plan.</p>
        ) : access.reason === 'trial' ? (
          <p className="mt-2 text-slate-800">
            You&apos;re in your free month, until {day(access.trial_ends_at)}
            {typeof access.days_left === 'number' ? ` (${access.days_left} day${access.days_left === 1 ? '' : 's'} left)` : ''}. Nothing is charged.
          </p>
        ) : access.reason === 'trial_over' ? (
          <p className="mt-2 text-slate-800">Your free month ended on {day(access.trial_ends_at)}. Nothing was charged.</p>
        ) : (
          <p className="mt-2 text-slate-800">You don&apos;t have a plan.</p>
        )}
        {access?.pending && <p className="mt-2 text-slate-800">We have your request for free access, and will email you when it&apos;s ready.</p>}
      </section>

      {sub && (
        <section aria-labelledby="your-plan" className="mt-6 rounded-xl border border-slate-200 p-5">
          <h2 id="your-plan" className="text-lg font-semibold text-slate-900">
            Your {sub.plan === 'yearly' ? 'yearly' : 'monthly'} plan
          </h2>
          <div className="mt-2 space-y-2 text-slate-800">
            {sub.status === 'canceled' ? (
              <p>It has ended. You won&apos;t be charged again.</p>
            ) : sub.cancel_at_period_end ? (
              <p>It is cancelled: it lasts until {day(sub.current_period_end)}, and you won&apos;t be charged again.</p>
            ) : sub.status === 'trialing' && sub.trial_end ? (
              <p>Nothing is charged until {day(sub.trial_end)}, when your free month ends. We email you before then.</p>
            ) : sub.current_period_end ? (
              <p>It renews on {day(sub.current_period_end)}.</p>
            ) : null}
            {sub.status === 'past_due' && <p className="font-medium text-red-800">Your last payment didn&apos;t go through. Please update your card.</p>}
            {sub.status === 'paused' && <p>It is paused. Add a card to start it again.</p>}
            {access?.reason === 'grant' && sub.status !== 'canceled' && !sub.cancel_at_period_end && (
              <p className="font-medium">You also have free access, so you may want to cancel your paid plan.</p>
            )}
          </div>
          {sub.status !== 'canceled' && (
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => go('/api/billing/portal', {}, 'portal')}
                disabled={Boolean(busy)}
                className="rounded-lg border border-indigo-700 px-4 py-2 font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-60"
              >
                {busy === 'portal' ? 'Opening…' : 'Change plan, card or receipts'}
              </button>
              {!sub.cancel_at_period_end && (
                <button
                  type="button"
                  onClick={() => go('/api/billing/portal', { flow: 'cancel' }, 'cancel')}
                  disabled={Boolean(busy)}
                  className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
                >
                  {busy === 'cancel' ? 'Opening…' : 'Cancel my plan'}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {canChoose && p && !hasPlan && access?.reason !== 'team' && access?.reason !== 'grant' && (
        <section aria-labelledby="choose" className="mt-6 rounded-xl border border-slate-200 p-5">
          <h2 id="choose" className="text-lg font-semibold text-slate-900">
            Choose a plan
          </h2>
          <fieldset className="mt-3">
            <legend className="sr-only">Plan</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['monthly', 'yearly'] as Plan[]).map((k) => (
                <label key={k} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
                  <input type="radio" name="plan" value={k} checked={plan === k} onChange={() => setPlan(k)} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="block font-semibold text-slate-900">{k === 'monthly' ? 'Monthly' : 'Yearly'}</span>
                    <span className="block text-xl font-bold text-slate-900">{p[k].label}</span>
                    <span className="block text-sm text-slate-700">
                      {planWords(k)}
                      {tax}
                      {k === 'yearly' && p.yearlySaves ? `, ${p.yearlySaves} less than monthly` : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-900">
            <p className="font-semibold">Before you continue</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                {p[plan].label} {planWords(plan)}
                {tax}, in Canadian dollars, paid by card through Stripe. No other fees.
              </li>
              <li>Your first payment: {firstCharge}. Then {plan === 'monthly' ? 'every month' : 'every year'} until you cancel.</li>
              <li>Cancel any time here, with “Cancel my plan”. Your plan runs to the end of the time you paid for, and you are not charged again.</li>
              <li>
                We email you a copy of this agreement{freeFirst ? ', and a few days before your free month ends' : ''}
                {plan === 'yearly' ? ', and before each yearly renewal' : ''}.
              </li>
              <li>
                From {BUSINESS.name}
                {BUSINESS.address ? `, ${BUSINESS.address}` : ''}
                {BUSINESS.phone ? `, ${BUSINESS.phone}` : ''}, {CONTACT_EMAIL}.
              </li>
            </ul>
            <label className="mt-3 flex items-start gap-2">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4" />
              <span>
                I have read this and the{' '}
                <Link href="/terms#paid-plans" target="_blank" className="font-medium text-indigo-800 underline underline-offset-2">
                  terms, including Paid plans
                </Link>
                , and I agree.
              </span>
            </label>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => go('/api/billing/checkout', { plan, agreed }, 'checkout')}
            disabled={!agreed || Boolean(busy)}
            className="mt-4 rounded-lg bg-indigo-700 px-5 py-2.5 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
          >
            {busy === 'checkout' ? 'Opening Stripe…' : 'Continue to secure payment'}
          </button>
          <p className="mt-2 text-sm text-slate-700">Stripe shows you everything again before you pay, and you can go back from there.</p>
        </section>
      )}
      {error && !canChoose && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {access && access.reason !== 'team' && access.reason !== 'grant' && (
        <section aria-labelledby="free" className="mt-6 rounded-xl border border-slate-200 p-5">
          <h2 id="free" className="text-lg font-semibold text-slate-900">
            Free access
          </h2>
          <p className="mt-2 text-slate-800">Students, people whose workplace or city partners with us, and people who help advocate can use Autinerary free.</p>
          <Link href="/free-access" className="mt-2 inline-block font-semibold text-indigo-800 underline underline-offset-2">
            See if you can
          </Link>
        </section>
      )}

      {(askWhy || cancelled || access?.reason === 'trial_over') && (
        <div className="mt-6">
          <WhyNotContinue moment={cancelled ? 'cancel' : 'trial_end'} heading={cancelled ? 'Would you tell us why you cancelled?' : undefined} />
        </div>
      )}

      <section aria-labelledby="fund" className="mt-6">
        <h2 id="fund" className="sr-only">
          Help make Autinerary free
        </h2>
        <HelpMakeItFree until={inFreeMonth ? access?.trial_ends_at : null} />
      </section>

      <p className="mt-8 text-sm">
        <Link href="/pricing" className="font-medium text-indigo-800 underline underline-offset-2">
          How Autinerary is paid for
        </Link>
        {' · '}
        <Link href="/profile/settings" className="font-medium text-indigo-800 underline underline-offset-2">
          Settings
        </Link>
      </p>
    </article>
  )
}
