/**
 * Paying for Autinerary (the team's planning note, October 2026, Goal 9: "the
 * Khan Academy model"): monthly or yearly, a free first month that needs no
 * card and is never charged, and free access through universities,
 * workplaces and governments. Everything is off until the team turns it on:
 *
 *   NEXT_PUBLIC_PAYMENTS=on   people can choose a plan (for testing with
 *                             Stripe's test keys before launch)
 *   NEXT_PUBLIC_PAYWALL=on    the app needs access: the free month, a plan or
 *                             free access (ResourceHub's directory, ratings
 *                             and Tidbits stay free); implies payments
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY,
 *   STRIPE_PRICE_YEARLY       Stripe (server only); prices are read from Stripe
 *   NEXT_PUBLIC_BUSINESS_ADDRESS, NEXT_PUBLIC_BUSINESS_PHONE
 *                             shown before anyone pays and in the copy of
 *                             their agreement (Ontario, O. Reg. 17/05 s. 32)
 *   STRIPE_TAX=on             Stripe Tax adds GST/HST (once registered)
 *
 * docs/subscriptions-2026-10.md says what the law asks for, and why each
 * choice here was made. Plain data with no imports, safe on both sides
 * (lib/billing.test.mjs).
 */
export const PAYWALL_ON = process.env.NEXT_PUBLIC_PAYWALL === 'on'
export const PAYMENTS_ON = PAYWALL_ON || process.env.NEXT_PUBLIC_PAYMENTS === 'on'

/** Who people pay; with lib/contact.ts's CONTACT_EMAIL. */
export const BUSINESS = {
  name: 'Autinerary Corp.',
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || '',
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE || '',
}

export const businessReady = () => Boolean(BUSINESS.address && BUSINESS.phone)

export type Plan = 'monthly' | 'yearly'

export const isPlan = (p: unknown): p is Plan => p === 'monthly' || p === 'yearly'

export interface PriceInfo {
  amount: number
  currency: string
  /** "$9.99 CAD" */
  label: string
}

export interface Prices {
  monthly: PriceInfo
  yearly: PriceInfo
  /** How much less a year costs than twelve months, rounded down: "16%". */
  yearlySaves: string | null
}

export const formatMoney = (cents: number, currency = 'cad') =>
  `${new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'narrowSymbol' }).format(cents / 100)} ${currency.toUpperCase()}`

export const planWords = (plan: Plan) => (plan === 'monthly' ? 'a month' : 'a year')

/** What a listing's owner can add to a sponsored listing's budget at a time, in cents (app/api/business/promotions/checkout). */
export const PROMOTION_BUDGETS = [2500, 5000, 10000, 25000]

/** Pages that stay open when someone has no access: paying, free access, the rules, and their own account. */
export const PAYWALL_OPEN = ['/', '/start', '/kits', '/go', '/billing', '/free-access', '/pricing', '/petition', '/terms', '/privacy', '/help', '/profile', '/auth', '/login', '/signup', '/forgot-password', '/reset-password', '/onboarding', '/newsletter', '/community-choice', '/spot-guides', '/emails', '/checkin', '/business', '/providers']

export const isPaywallOpen = (path: string) => PAYWALL_OPEN.some((p) => path === p || path.startsWith(`${p}/`))

/** Why someone didn't continue (the planning note: "receiving feedback for users who didn't want to extend after FREE month"). */
export const FEEDBACK_REASONS = [
  { id: 'too_expensive', label: 'It costs too much for me' },
  { id: 'not_useful', label: 'It wasn’t useful enough' },
  { id: 'missing_features', label: 'Something I need is missing' },
  { id: 'too_hard', label: 'It was hard to use' },
  { id: 'found_alternative', label: 'I use something else' },
  { id: 'just_trying', label: 'I was only trying it' },
  { id: 'temporary', label: 'Not now, maybe later' },
  { id: 'other', label: 'Something else' },
] as const

/** The four ways to free access (the planning note: Students, Employees, Other, None). */
export const ACCESS_KINDS = [
  {
    id: 'student',
    label: 'Students',
    text: 'Register as a student. Universities and colleges in the Uni Alliance get Autinerary free for their students, and in return Autinerary sponsors student club activities. Every student who registers helps their school say yes.',
  },
  { id: 'employee', label: 'Employees', text: 'If your workplace partners with Autinerary, it gives you a code for free access.' },
  { id: 'government', label: 'Your government or city', text: 'If your city, province or a government program partners with Autinerary, it gives you a code.' },
  { id: 'advocate', label: 'None of these', text: 'Explain your situation. If you will help ask your town or school to fund Autinerary, we will give you access.' },
] as const
