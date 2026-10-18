import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/contact'
import type { ReactNode } from 'react'
import { ACCESS_KINDS, BUSINESS, PAYMENTS_ON, PAYWALL_ON } from '@/lib/billing'
import { getPrices, paymentsReady } from '@/lib/stripe'
import HelpMakeItFree from '../components/HelpMakeItFree'

export const metadata: Metadata = {
  title: 'How Autinerary is paid for · Autinerary',
  description: 'Free during the beta. A free first month with no card, then monthly or yearly, and free access through schools, workplaces and governments.',
}

export const revalidate = 600

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-xl font-bold text-slate-900">
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-800">{children}</div>
    </section>
  )
}

/**
 * How Autinerary is paid for (the planning note's Goal 9, "the Khan Academy
 * model"), for anyone: what stays free, the free month, the plans and their
 * prices (read from Stripe), the four ways to free access, and everything the
 * law asks to be shown before anyone pays (docs/subscriptions-2026-10.md).
 */
export default async function PricingPage() {
  const prices = PAYMENTS_ON && paymentsReady() ? await getPrices() : null
  const tax = process.env.STRIPE_TAX === 'on' ? ', plus GST or HST where it applies' : ''
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-indigo-800">Autinerary</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">How Autinerary is paid for</h1>
        {!PAYWALL_ON && (
          <p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-slate-900">
            Autinerary is free during the beta. Before paid plans start, we will tell you, and nothing is ever charged unless you
            choose a plan.
          </p>
        )}

        <Section id="free" title="Always free">
          <ul className="list-disc space-y-1.5 pl-6">
            <li>ResourceHub: the directory of services, ratings from people who used them, Tidbits, and Community’s Choice.</li>
            <li>Starter kits, and the help lines (911, and 9-8-8 to call or text).</li>
          </ul>
        </Section>

        <Section id="plans" title="The Autinerary app">
          <p>
            <strong>Your first month is free.</strong> No card is needed, and nothing is charged. After that, choose a plan, or
            use one of the ways to free access below.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Monthly</h3>
              <p className="mt-1 text-2xl font-bold text-slate-900">{prices ? prices.monthly.label : 'Price to come'}</p>
              <p className="text-sm text-slate-700">a month{tax}, until you cancel</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Yearly</h3>
              <p className="mt-1 text-2xl font-bold text-slate-900">{prices ? prices.yearly.label : 'Price to come'}</p>
              <p className="text-sm text-slate-700">
                a year{tax}, until you cancel{prices?.yearlySaves ? `: ${prices.yearlySaves} less than paying monthly` : ''}
              </p>
            </div>
          </div>
          <p>Both give you everything in the app: your plan, calendar, check-ins, and the people helping you.</p>
          {prices && (
            <p>
              <Link href="/billing" className="font-semibold text-indigo-800 underline underline-offset-2">
                Choose a plan
              </Link>{' '}
              (you need to be signed in).
            </p>
          )}
        </Section>

        <Section id="free-access" title="Free access">
          <ul className="grid gap-3 sm:grid-cols-2">
            {ACCESS_KINDS.map((k) => (
              <li key={k.id} className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">{k.label}</h3>
                <p className="mt-1 text-sm">{k.text}</p>
              </li>
            ))}
          </ul>
          <p>
            <Link href="/free-access" className="font-semibold text-indigo-800 underline underline-offset-2">
              Get free access
            </Link>
          </p>
        </Section>

        <Section id="fund" title="Help us make it free for everyone">
          <p>
            Universities, colleges, workplaces and governments pay for services like this for the people they serve. Ask yours
            to fund Autinerary.
          </p>
          <HelpMakeItFree />
        </Section>

        <Section id="details" title="The details">
          <ul className="list-disc space-y-1.5 pl-6">
            <li>
              Who you pay: {BUSINESS.name}
              {BUSINESS.address ? `, ${BUSINESS.address}` : ''}
              {BUSINESS.phone ? `, ${BUSINESS.phone}` : ''}, {CONTACT_EMAIL}.
            </li>
            <li>Prices are in Canadian dollars{tax ? ', and tax is added where it applies' : ''}. There are no other fees.</li>
            <li>You pay by card, through Stripe. We never see your card number.</li>
            <li>If you choose a plan during your free month, your first payment is when the month ends. We email you before then.</li>
            <li>A plan renews each month or year until you cancel. Before a yearly plan renews, we email you 60 to 75 days ahead.</li>
            <li>Cancel any time in Billing, with “Cancel my plan”. Your plan then runs to the end of the time you have paid for, and you are not charged again.</li>
            <li>Charged by mistake? Email us within 30 days and we will refund it.</li>
            <li>We tell you at least 30 days before a price change.</li>
            <li>
              The rest is in the{' '}
              <Link href="/terms#paid-plans" className="font-medium text-indigo-800 underline underline-offset-2">
                terms (Paid plans)
              </Link>
              .
            </li>
          </ul>
        </Section>

        <p className="mt-10 text-sm">
          <Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">
            Back to Autinerary
          </Link>
        </p>
      </article>
    </div>
  )
}
