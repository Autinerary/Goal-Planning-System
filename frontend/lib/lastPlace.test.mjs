// Run from frontend/: node --experimental-strip-types lib/lastPlace.test.mjs
import assert from 'node:assert/strict'
import { placeName, placeToOffer, AWAY_MS, STALE_MS } from './lastPlace.ts'

assert.equal(placeName('/milestones/m_1'), 'step')
assert.equal(placeName('/calendar'), 'Calendar')
assert.equal(placeName('/kits/assessment'), 'starter kit')
assert.equal(placeName('/path'), null)
assert.equal(placeName('/profile/settings'), null)
assert.equal(placeName('/onboarding'), null)

const now = Date.UTC(2026, 9, 14, 12)
const last = { path: '/milestones/m_1', at: now - 2 * 60 * 60 * 1000, user: 'u1' }
// From an earlier visit: offered.
assert.deepEqual(placeToOffer(last, 'u1', now, now - 60 * 1000), last)
// The same visit: not offered.
assert.equal(placeToOffer({ ...last, at: now - 5 * 60 * 1000 }, 'u1', now, now - 10 * 60 * 1000), null)
// Someone else's account on this browser: not offered.
assert.equal(placeToOffer(last, 'u2', now, now), null)
// Too long ago, or not a place to go back to.
assert.equal(placeToOffer({ ...last, at: now - STALE_MS - 1 }, 'u1', now, now), null)
assert.equal(placeToOffer({ ...last, path: '/profile' }, 'u1', now, now), null)
assert.equal(placeToOffer(null, 'u1', now, now), null)
assert.ok(AWAY_MS >= 10 * 60 * 1000)
console.log('lastPlace: ok')
