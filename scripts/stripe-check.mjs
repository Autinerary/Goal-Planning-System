#!/usr/bin/env node
/**
 * Checks Autinerary's Stripe setup without changing anything: only reads.
 * Run it after scripts/stripe-setup.mjs (or after making the product, prices
 * and webhook by hand), and again with the live key before going live. It
 * prints what it finds, never a key or a secret.
 *
 *   STRIPE_SECRET_KEY=sk_test_... STRIPE_PRICE_MONTHLY=price_... STRIPE_PRICE_YEARLY=price_... \
 *     node scripts/stripe-check.mjs [--app https://app.autinerary.ca]
 *
 * It checks that:
 *   - the variable names are the ones the app reads (lib/stripe.ts);
 *   - the key works, and whether it is a test or a live key;
 *   - the account is Autinerary's alone: the prices belong to an Autinerary
 *     product, and no other app's webhook endpoint would also receive
 *     Autinerary's billing events (Stripe sends every event to every endpoint);
 *   - the monthly and yearly prices exist, are active, in Canadian dollars,
 *     recurring every month and every year (not swapped), and the yearly one
 *     costs less than twelve months;
 *   - the webhook endpoint for the app exists, is enabled and listens for every
 *     event the app handles (a signing secret can't be read back from Stripe:
 *     STRIPE_WEBHOOK_SECRET must be this endpoint's, from the Dashboard);
 *   - the customer portal lets people cancel at the end of the period, change
 *     plan and update their card, as the terms say;
 *   - Stripe Connect is on, which the shop's checkout needs.
 * Exits 1 if anything the app needs is missing.
 */
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const { default: Stripe } = await import(path.join(ROOT, 'frontend/node_modules/stripe/esm/stripe.esm.node.js')).catch(() => import(path.join(ROOT, 'frontend/node_modules/stripe/cjs/stripe.cjs.node.js')))

const args = process.argv.slice(2)
const APP = ((args.includes('--app') ? args[args.indexOf('--app') + 1] : '') || 'https://app.autinerary.ca').replace(/\/$/, '')
const env = process.env
// What the app reads (frontend/lib/stripe.ts), and names people tend to use instead.
const WRONG_NAMES = { STRIPE_MONTHLY_PRICE_ID: 'STRIPE_PRICE_MONTHLY', STRIPE_ANNUAL_PRICE_ID: 'STRIPE_PRICE_YEARLY', STRIPE_YEARLY_PRICE_ID: 'STRIPE_PRICE_YEARLY', STRIPE_PRICE_ANNUAL: 'STRIPE_PRICE_YEARLY' }
const EVENTS = [
  'checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed', 'customer.subscription.trial_will_end', 'invoice.paid', 'invoice.payment_failed',
]

let bad = 0
const say = (ok, what, detail = '') => {
  if (ok === false) bad++
  console.log(`${ok === true ? 'ok   ' : ok === false ? 'FAIL ' : 'note '} ${what}${detail ? `  (${detail})` : ''}`)
}
const money = (cents, currency) => `${(cents / 100).toFixed(2)} ${String(currency).toUpperCase()}`

const key = env.STRIPE_SECRET_KEY || ''
if (!/^sk_(test|live)_/.test(key)) {
  console.error('Set STRIPE_SECRET_KEY (sk_test_... or sk_live_...), STRIPE_PRICE_MONTHLY and STRIPE_PRICE_YEARLY, then run again.')
  process.exit(1)
}
const live = key.startsWith('sk_live_')

// 1. The names.
for (const [wrong, right] of Object.entries(WRONG_NAMES)) {
  if (env[wrong] && !env[right]) say(false, `${wrong} is set, but the app reads ${right}`, 'rename it in Vercel')
}
say(Boolean(env.STRIPE_PRICE_MONTHLY && env.STRIPE_PRICE_YEARLY), 'STRIPE_PRICE_MONTHLY and STRIPE_PRICE_YEARLY are set')
say(env.STRIPE_WEBHOOK_SECRET ? /^whsec_/.test(env.STRIPE_WEBHOOK_SECRET) : null, env.STRIPE_WEBHOOK_SECRET ? 'STRIPE_WEBHOOK_SECRET looks like a signing secret' : 'STRIPE_WEBHOOK_SECRET not given here (the app needs it in Vercel)')

const stripe = new Stripe(key)
say(null, live ? 'LIVE key: real charges' : 'test key: nothing is charged')

// 2. The key and the account.
try {
  const account = await stripe.accounts.retrieve()
  say(true, 'the key works', `${account.country || '?'}, ${String(account.default_currency || '?').toUpperCase()}, charges ${account.charges_enabled ? 'on' : 'not on yet'}`)
  if (account.country && account.country !== 'CA') say(false, `the Stripe account is in ${account.country}, not Canada`)
  if (live && !account.charges_enabled) say(false, 'the live account can’t take charges yet', 'finish activating it in the Dashboard')
} catch (e) {
  say(false, 'the key doesn’t work', e.message)
  process.exit(1)
}

// 3. The two prices.
const found = {}
for (const [name, id, interval] of [['monthly', env.STRIPE_PRICE_MONTHLY, 'month'], ['yearly', env.STRIPE_PRICE_YEARLY, 'year']]) {
  if (!id) continue
  try {
    const p = await stripe.prices.retrieve(id, { expand: ['product'] })
    found[name] = p
    const product = typeof p.product === 'object' ? p.product : null
    // Made by scripts/stripe-setup.mjs (metadata) or at least named for Autinerary; anything else is another product's price.
    if (product && product.metadata?.autinerary !== 'app' && !/autinerary/i.test(product.name || '')) {
      say(false, `the ${name} price belongs to “${product.name}”, not to Autinerary`, 'wrong Stripe account, or a price made for something else? People would be charged for that product')
    }
    say(p.active, `the ${name} price exists and is active`, `${money(p.unit_amount ?? 0, p.currency)} every ${p.recurring?.interval_count || 1} ${p.recurring?.interval || 'one-time'}${product ? `, product “${product.name}”${product.active ? '' : ' (archived)'}` : ''}`)
    say(p.currency === 'cad', `the ${name} price is in Canadian dollars`, p.currency.toUpperCase())
    say(p.recurring?.interval === interval && (p.recurring?.interval_count || 1) === 1, `the ${name} price recurs every ${interval}`, p.recurring ? `every ${p.recurring.interval_count} ${p.recurring.interval}` : 'not recurring')
    if (p.livemode !== live) say(false, `the ${name} price is ${p.livemode ? 'live' : 'test'}-mode but the key is ${live ? 'live' : 'test'}`)
    say(p.tax_behavior && p.tax_behavior !== 'unspecified' ? true : null, `the ${name} price says whether tax is added on top`, p.tax_behavior || 'unspecified: needed only once STRIPE_TAX=on')
  } catch (e) {
    say(false, `the ${name} price can’t be read`, e.message)
  }
}
if (found.monthly?.unit_amount && found.yearly?.unit_amount) {
  const twelve = found.monthly.unit_amount * 12
  const saves = Math.floor((1 - found.yearly.unit_amount / twelve) * 100)
  say(found.yearly.unit_amount < twelve, 'the yearly price is less than twelve months', saves > 0 ? `saves ${saves}%` : `${money(found.yearly.unit_amount, found.yearly.currency)} vs ${money(twelve, found.monthly.currency)}`)
}

// 4. The webhook.
try {
  const hooks = (await stripe.webhookEndpoints.list({ limit: 100 })).data
  const url = `${APP}/api/stripe/webhook`
  const hook = hooks.find((w) => w.url === url)
  if (!hook) {
    say(false, `no webhook endpoint for ${url}`, hooks.length ? `found: ${hooks.map((w) => new URL(w.url).host + new URL(w.url).pathname).join(', ')}` : 'none at all')
  } else {
    say(hook.status === 'enabled', 'the webhook endpoint exists and is enabled', hook.url)
    const all = hook.enabled_events.includes('*')
    const missing = all ? [] : EVENTS.filter((e) => !hook.enabled_events.includes(e))
    say(missing.length === 0, 'it listens for every event the app handles', missing.length ? `missing: ${missing.join(', ')}` : all ? 'all events' : `${EVENTS.length} events`)
    if (hook.livemode !== live) say(false, `the webhook is ${hook.livemode ? 'live' : 'test'}-mode but the key is ${live ? 'live' : 'test'}`)
    say(null, 'STRIPE_WEBHOOK_SECRET must be this endpoint’s signing secret', 'Stripe can’t show it again: copy it from Dashboard → Developers → Webhooks, or roll it')
  }
  // Stripe sends every event of the account to every endpoint: another app's endpoint would receive Autinerary's customers' billing events.
  const others = hooks.filter((w) => w.url !== url)
  if (others.length) say(false, `${others.length} other webhook endpoint(s) in this Stripe account would also receive Autinerary's billing events (customers' emails, plans)`, `${others.map((w) => new URL(w.url).host).join(', ')}; use a Stripe account that is only Autinerary's`)
} catch (e) {
  say(false, 'the webhook endpoints can’t be read', e.message)
}

// 5. The customer portal.
try {
  const portals = (await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 })).data
  const portal = portals[0]
  if (!portal) {
    say(false, 'no default customer portal', 'run scripts/stripe-setup.mjs, or set one in Dashboard → Settings → Billing → Customer portal')
  } else {
    const f = portal.features
    say(f.subscription_cancel?.enabled === true, 'people can cancel in the portal', f.subscription_cancel?.enabled ? `${f.subscription_cancel.mode === 'at_period_end' ? 'at the end of the period' : 'at once'}` : '')
    if (f.subscription_cancel?.enabled) say(f.subscription_cancel.mode === 'at_period_end', 'cancelling takes effect at the end of the period', f.subscription_cancel.mode)
    say(f.payment_method_update?.enabled === true, 'people can update their card in the portal')
    say(f.subscription_update?.enabled === true ? true : null, 'people can switch between monthly and yearly in the portal', f.subscription_update?.enabled ? '' : 'off: they would cancel and start again')
    say(f.invoice_history?.enabled === true ? true : null, 'people can see their receipts in the portal')
  }
} catch (e) {
  say(false, 'the customer portal can’t be read', e.message)
}

// 6. Connect, for the shop.
try {
  await stripe.accounts.list({ limit: 1 })
  say(true, 'Stripe Connect is on', 'the shop’s checkout can use it (NEXT_PUBLIC_SHOP_CHECKOUT)')
} catch (e) {
  say(null, 'Stripe Connect isn’t on yet', `needed only for the shop's checkout: ${String(e.message).slice(0, 110)}`)
}

console.log(bad ? `\n${bad} thing(s) to fix.` : '\nNothing to fix.')
process.exit(bad ? 1 : 0)
