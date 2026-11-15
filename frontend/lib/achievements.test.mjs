// Run from frontend/: node --experimental-strip-types lib/achievements.test.mjs
//
// Achievements (lib/achievements.ts, pull request #3, STEP 104): each has what the page needs, the friend tiers go up,
// and Halloween is the person's own 31 October, not the server's (UTC).
import assert from 'node:assert/strict'
import { ACHIEVEMENTS, DEFAULT_TIME_ZONE, isHalloween, knownTimeZone } from './achievements.ts'

// What the page shows for each one.
const ids = ACHIEVEMENTS.map((a) => a.id)
assert.equal(new Set(ids).size, ids.length, 'achievement ids are unique')
for (const a of ACHIEVEMENTS) {
  assert.ok(a.title && a.description && a.icon, `${a.id} has a title, a description and an icon`)
  assert.ok(['social', 'seasonal'].includes(a.category), `${a.id} has a known category`)
}
// The server's friend milestones (lib/server/achievements.ts) are these ids, at these thresholds.
const friends = ACHIEVEMENTS.filter((a) => a.threshold).map((a) => [a.id, a.threshold])
assert.deepEqual(friends, [['friends_1', 1], ['friends_5', 5], ['friends_10', 10]])
assert.ok(ids.includes('halloween_login'))

// Time zones: a real one is kept; anything else is Toronto's.
assert.equal(knownTimeZone('America/Vancouver'), 'America/Vancouver')
for (const bad of [undefined, null, '', 'Not/AZone', 42, 'x'.repeat(80)]) assert.equal(knownTimeZone(bad), DEFAULT_TIME_ZONE)

// Halloween evening in Toronto is already 1 November in UTC: it counts in Toronto, as the person sees it.
const torontoEvening = new Date('2026-10-31T21:30:00-04:00')
assert.equal(isHalloween('America/Toronto', torontoEvening), true)
assert.equal(isHalloween('UTC', torontoEvening), false)
// The evening before, in Toronto, is 31 October in UTC: it doesn't count in Toronto.
assert.equal(isHalloween('America/Toronto', new Date('2026-10-30T21:00:00-04:00')), false)
// The far side of the world: early on the 31st in Tokyo is still the 30th in UTC.
assert.equal(isHalloween('Asia/Tokyo', new Date('2026-10-30T16:30:00Z')), true)
// No time zone, or a made-up one, is Toronto's.
assert.equal(isHalloween(undefined, torontoEvening), true)
assert.equal(isHalloween('Not/AZone', torontoEvening), true)
// Any other day.
assert.equal(isHalloween('America/Toronto', new Date('2026-11-14T12:00:00-05:00')), false)
assert.equal(isHalloween('America/Toronto', new Date('2027-10-31T09:00:00-04:00')), true)

console.log('achievements: ok')
