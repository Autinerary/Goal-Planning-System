// Run from frontend/: node --experimental-strip-types lib/welcomeBackfill.test.mjs
import assert from 'node:assert/strict'
import { isCandidate, isPaused, notAPerson } from './welcomeBackfill.ts'

const person = (over = {}) => ({ email: 'sam@example.org', user_metadata: { has_completed_onboarding: true }, app_metadata: {}, banned_until: null, ...over })

// Someone who finished setup and was never welcomed.
assert.ok(isCandidate(person()))
// Not twice, not before setup is done.
assert.ok(!isCandidate(person({ app_metadata: { welcome_email_sent_at: '2026-10-09T15:00:00Z' } })))
assert.ok(!isCandidate(person({ user_metadata: {} })))
assert.ok(!isCandidate(person({ user_metadata: { has_completed_onboarding: false } })))
// Not children, nor locked accounts.
assert.ok(!isCandidate(person({ app_metadata: { managed_by_guardian: true } })))
assert.ok(!isCandidate(person({ user_metadata: { has_completed_onboarding: true, managed_by_guardian: true } })))
assert.ok(!isCandidate(person({ banned_until: '2999-01-01T00:00:00Z' })))
assert.ok(!isCandidate(person({ email: undefined })))
// Not the team's own or made-up accounts.
for (const email of ['test.account+riipen-e2e-1@test.com', 'synthetic+1_2@autinerary.dev', 'aayush+team@autinerary.ca', 'child1@x.org', 'bhanaayush@gmail.com', 'AAYUSH_BHAN@hotmail.com']) {
  assert.ok(notAPerson(email), email)
  assert.ok(!isCandidate(person({ email })), email)
}
assert.ok(!notAPerson('jordan@gmail.com') && !notAPerson('someone@autinerary.ca'))
// A break means no email.
assert.ok(isPaused({ paused: { since: '2026-10-01', wasDiscoverable: true } }))
assert.ok(!isPaused({ paused: null }) && !isPaused({}) && !isPaused(null))
console.log('welcomeBackfill: ok')
