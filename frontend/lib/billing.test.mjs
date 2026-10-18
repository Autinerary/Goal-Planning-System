// Run from frontend/: node --experimental-strip-types lib/billing.test.mjs
import assert from 'node:assert/strict'
import { formatMoney, isPaywallOpen, isPlan, planWords, FEEDBACK_REASONS, ACCESS_KINDS } from './billing.ts'

// What stays open when someone has no access: paying, free access, the rules, their account, the public pages.
for (const open of ['/', '/billing', '/billing?done=1'.split('?')[0], '/free-access', '/pricing', '/petition', '/terms', '/privacy', '/profile/settings', '/kits/school', '/start', '/business', '/help']) {
  assert.equal(isPaywallOpen(open), true, open)
}
// And what doesn't: the app itself. "/" opens only the home page, not everything under it.
for (const closed of ['/path', '/calendar', '/hare-world', '/tasks', '/assistant', '/reflection', '/billingx', '/termsandmore']) {
  assert.equal(isPaywallOpen(closed), false, closed)
}

// Prices as people read them, in Canadian dollars.
assert.equal(formatMoney(999), '$9.99 CAD')
assert.equal(formatMoney(9990, 'cad'), '$99.90 CAD')
assert.equal(formatMoney(400, 'usd'), '$4.00 USD')

assert.equal(isPlan('monthly'), true)
assert.equal(isPlan('yearly'), true)
assert.equal(isPlan('weekly'), false)
assert.equal(planWords('monthly'), 'a month')
assert.equal(planWords('yearly'), 'a year')

// The reasons match STEP 81's subscription_feedback CHECK, and the four kinds of free access are there.
assert.deepEqual(FEEDBACK_REASONS.map((r) => r.id), ['too_expensive', 'not_useful', 'missing_features', 'too_hard', 'found_alternative', 'just_trying', 'temporary', 'other'])
assert.deepEqual(ACCESS_KINDS.map((k) => k.id), ['student', 'employee', 'government', 'advocate'])

console.log('billing: ok')
