// Run from frontend/: node --experimental-strip-types lib/checkinDue.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkinDue } from './checkinDue.ts'

// Someone who joined, did the questions after setup on another day, and came
// back on a second day: the day-3 and day-7 questions can be asked.
const base = {
  joined: '2026-10-01',
  day: 0,
  lastVisit: '2026-10-01',
  daysAway: 0,
  awayDays: 14,
  visitDays: 2,
  feedbackDone: true,
  feedbackToday: false,
  welcomeBackAskedFor: null,
  earlyAsked: false,
  earlyToday: false,
  usefulnessAsked: false,
}
const at = (day, more = {}) => checkinDue({ ...base, day, ...more })

// Riipen Labs, Group 12: "Trigger quick micro-surveys on Day 3 and Day 7".
for (const day of [0, 1, 2]) assert.equal(at(day), null, `nothing on day ${day}`)
for (const day of [3, 4, 5, 6]) assert.deepEqual(at(day), { kind: 'early' }, `day 3 question on day ${day}`)
assert.deepEqual(at(7), { kind: 'usefulness' })
assert.deepEqual(at(20), { kind: 'usefulness' })
// Coming back first on day 8 skips the day-3 question rather than asking it late.
assert.deepEqual(at(8, { earlyAsked: false }), { kind: 'usefulness' })

// Once each.
assert.equal(at(4, { earlyAsked: true }), null)
assert.equal(at(9, { usefulnessAsked: true, earlyAsked: true }), null)
// Never the day-3 and day-7 questions on the same day.
assert.equal(at(7, { earlyAsked: true, earlyToday: true }), null)

// Not before the questions after setup are done, nor on that day, and not
// before a second day of use.
assert.equal(at(4, { feedbackDone: false }), null)
assert.equal(at(4, { feedbackToday: true }), null)
assert.equal(at(4, { visitDays: 1 }), null)
assert.equal(at(4, { joined: null }), null)

// Welcome back comes first, once per absence, and only for an absence after joining.
assert.deepEqual(at(30, { lastVisit: '2026-10-05', daysAway: 20 }), { kind: 'welcome_back', lastVisit: '2026-10-05' })
assert.deepEqual(at(30, { lastVisit: '2026-10-05', daysAway: 20, welcomeBackAskedFor: '2026-10-05' }), { kind: 'usefulness' })
assert.deepEqual(at(30, { lastVisit: '2026-09-20', daysAway: 20 }), { kind: 'usefulness' })
assert.deepEqual(at(5, { lastVisit: '2026-10-01', daysAway: 13 }), { kind: 'early' })

// The prompt uses this, with the app's own away time.
const prompt = readFileSync(new URL('../app/components/CheckinPrompt.tsx', import.meta.url), 'utf8')
assert.ok(prompt.includes('checkinDue({') && prompt.includes('awayDays: AWAY_DAYS'))

console.log('checkinDue: all checks passed')
