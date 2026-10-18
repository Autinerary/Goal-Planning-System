#!/usr/bin/env node
/**
 * Sets up Stripe for Autinerary's paid plans in one go (docs/subscriptions-2026-10.md,
 * "Turning it on"), for whoever holds the Stripe account. Use a test key first.
 *
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs --monthly 9.99 --yearly 99.90
 *
 * It makes (or finds, if run again) the product "Autinerary" with a monthly
 * and a yearly price in Canadian dollars, sets the customer portal the way the
 * terms describe (cancel at the end of the period, with the reason asked;
 * switch between the two plans; update the card; receipts), and adds the
 * webhook https://app.autinerary.ca/api/stripe/webhook with the events the
 * app handles. Then it prints the four values to put in Vercel (project
 * goal-planning-app). The key is read from the environment and never saved.
 */
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const { default: Stripe } = await import(path.join(ROOT, 'frontend/node_modules/stripe/esm/stripe.esm.node.js')).catch(() => import(path.join(ROOT, 'frontend/node_modules/stripe/cjs/stripe.cjs.node.js')))

const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const APP = (arg('--app') || 'https://app.autinerary.ca').replace(/\/$/, '')
const monthly = Number(arg('--monthly'))
const yearly = Number(arg('--yearly'))
const key = process.env.STRIPE_SECRET_KEY || ''
if (!/^sk_(test|live)_/.test(key) || !(monthly > 0) || !(yearly > 0)) {
  console.error('Usage: STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs --monthly 9.99 --yearly 99.90 [--app https://app.autinerary.ca]')
  process.exit(1)
}
if (yearly >= monthly * 12) console.warn(`Note: the yearly price (${yearly}) is not less than 12 months (${(monthly * 12).toFixed(2)}).`)
const stripe = new Stripe(key)
const live = key.startsWith('sk_live_')
const cents = (n) => Math.round(n * 100)

const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
]

// The product, found by its metadata so a second run doesn't make another.
let product = (await stripe.products.search({ query: "metadata['autinerary']:'app'" })).data[0]
if (!product) {
  product = await stripe.products.create({
    name: 'Autinerary',
    description: 'Full use of the Autinerary app: your plan, calendar, check-ins and the people helping you. ResourceHub stays free.',
    metadata: { autinerary: 'app' },
  })
  console.log(`Made the product ${product.id}`)
} else console.log(`Found the product ${product.id}`)

async function price(interval, amount) {
  const found = (await stripe.prices.list({ product: product.id, active: true, limit: 100 })).data.find(
    (p) => p.recurring?.interval === interval && p.unit_amount === cents(amount) && p.currency === 'cad'
  )
  if (found) return found
  return stripe.prices.create({
    product: product.id,
    currency: 'cad',
    unit_amount: cents(amount),
    recurring: { interval },
    tax_behavior: 'exclusive',
    nickname: interval === 'month' ? 'Monthly' : 'Yearly',
    metadata: { autinerary: interval === 'month' ? 'monthly' : 'yearly' },
  })
}
const m = await price('month', monthly)
const y = await price('year', yearly)
console.log(`Monthly ${m.id} (${monthly} CAD), yearly ${y.id} (${yearly} CAD)`)

// The customer portal, as the terms say: cancel at the end of the period,
// with the reason asked; switch plan; card; receipts.
const portal = {
  business_profile: { headline: 'Autinerary: your plan', privacy_policy_url: `${APP}/privacy`, terms_of_service_url: `${APP}/terms#paid-plans` },
  default_return_url: `${APP}/billing`,
  features: {
    customer_update: { enabled: true, allowed_updates: ['email', 'address'] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'customer_service', 'too_complex', 'low_quality', 'other'] },
    },
    // Switching plan in the free month keeps the free month (it would otherwise end it, and charge at once).
    subscription_update: { enabled: true, default_allowed_updates: ['price'], proration_behavior: 'create_prorations', trial_update_behavior: 'continue_trial', products: [{ product: product.id, prices: [m.id, y.id] }] },
  },
}
const current = (await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 })).data[0]
if (current) {
  await stripe.billingPortal.configurations.update(current.id, portal)
  console.log(`Set the customer portal (${current.id})`)
} else {
  const made = await stripe.billingPortal.configurations.create(portal)
  console.log(`Made the customer portal (${made.id})`)
}

// The webhook: one endpoint, the events the app handles.
const url = `${APP}/api/stripe/webhook`
let hook = (await stripe.webhookEndpoints.list({ limit: 100 })).data.find((w) => w.url === url)
let secret = null
if (hook) {
  await stripe.webhookEndpoints.update(hook.id, { enabled_events: EVENTS })
  console.log(`Found the webhook ${hook.id}; its events are set. Its signing secret is in the Dashboard (Developers, Webhooks).`)
} else {
  hook = await stripe.webhookEndpoints.create({ url, enabled_events: EVENTS, description: 'Autinerary app: plans and billing emails' })
  secret = hook.secret
  console.log(`Made the webhook ${hook.id}`)
}

console.log(`\nPut these in Vercel, project goal-planning-app (${live ? 'LIVE keys: real charges' : 'test keys'}):`)
console.log(`  STRIPE_SECRET_KEY      the key you used`)
console.log(`  STRIPE_PRICE_MONTHLY   ${m.id}`)
console.log(`  STRIPE_PRICE_YEARLY    ${y.id}`)
console.log(`  STRIPE_WEBHOOK_SECRET  ${secret || '(from the Dashboard: Developers, Webhooks, this endpoint, Signing secret)'}`)
console.log(`  NEXT_PUBLIC_BUSINESS_ADDRESS and NEXT_PUBLIC_BUSINESS_PHONE   your business address and phone`)
console.log(`Then NEXT_PUBLIC_PAYMENTS=on to try it (with test keys), and redeploy.`)
