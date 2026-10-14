// Run from frontend/: node --experimental-strip-types lib/firstWeeks.test.mjs
import assert from 'node:assert/strict'
import {
  FIRST_WEEKS_CONSENT, firstWeeksDue, firstWeeksStillAhead, dayOfAccount, recapLines, communityAction, count,
} from './firstWeeks.ts'

const zone = 'America/Toronto'
const joined = '2026-10-01T14:00:00Z'   // 10:00 in Toronto, 1 October
const at = (day, hour) => new Date(Date.UTC(2026, 9, 1 + day, hour + 4))   // Toronto is UTC-4 in October
const on = { enabled: true, consent: FIRST_WEEKS_CONSENT, timeZone: zone, sent: {} }

// Days of the account, where they live.
assert.equal(dayOfAccount(joined, zone, at(0, 23)), 0)
assert.equal(dayOfAccount(joined, zone, at(1, 0)), 1)
assert.equal(dayOfAccount(joined, zone, at(14, 12)), 14)

// Each email on its day, between 10:00 and 19:59 where they live.
assert.equal(firstWeeksDue(on, joined, at(0, 12)), null)        // the day they joined
assert.equal(firstWeeksDue(on, joined, at(1, 9)), null)         // too early in the day
assert.equal(firstWeeksDue(on, joined, at(1, 10)), 1)
assert.equal(firstWeeksDue(on, joined, at(1, 20)), null)        // too late in the day
assert.equal(firstWeeksDue({ ...on, sent: { day1: 'x' } }, joined, at(2, 12)), null)   // sent: never twice
assert.equal(firstWeeksDue(on, joined, at(3, 12)), 1)           // still in time on day 3
assert.equal(firstWeeksDue(on, joined, at(4, 12)), null)        // too late to help
assert.equal(firstWeeksDue(on, joined, at(7, 12)), 7)
assert.equal(firstWeeksDue(on, joined, at(11, 12)), null)
assert.equal(firstWeeksDue({ ...on, sent: { day1: 'x', day7: 'y' } }, joined, at(14, 12)), 14)
assert.equal(firstWeeksDue({ ...on, sent: { day1: 'x', day7: 'y', day14: 'z' } }, joined, at(15, 12)), null)
assert.equal(firstWeeksDue(on, joined, at(18, 12)), null)

// Only when asked for, with the words agreed to, and not after stopping.
assert.equal(firstWeeksDue({ ...on, enabled: false }, joined, at(1, 12)), null)
assert.equal(firstWeeksDue({ ...on, consent: undefined }, joined, at(1, 12)), null)
assert.equal(firstWeeksDue({ ...on, stoppedAt: '2026-10-02T00:00:00Z' }, joined, at(7, 12)), null)
assert.equal(firstWeeksDue(on, null, at(1, 12)), null)
assert.equal(firstWeeksDue(null, joined, at(1, 12)), null)

// Worth offering until day 17.
assert.equal(firstWeeksStillAhead(joined, zone, at(17, 12)), true)
assert.equal(firstWeeksStillAhead(joined, zone, at(18, 12)), false)
assert.equal(firstWeeksStillAhead(null, zone, at(30, 12)), true)

// The recap says only what happened, in plain words.
const none = { goal: null, nextStep: null, stepsDone: 0, stepsTotal: 16, savedPlaces: 0, daysOpened: 0, journalEntries: 0, audience: null }
assert.deepEqual(recapLines(none), [])
assert.deepEqual(recapLines({ ...none, daysOpened: 3, stepsDone: 1, savedPlaces: 2, journalEntries: 1 }), [
  'You opened Autinerary on 3 days.',
  'You finished 1 step of 16.',
  'You saved 2 places in ResourceHub.',
  'You wrote 1 journal entry.',
])
assert.equal(count(1, 'day', 'days'), '1 day')

// A community action for each kind of person, always in Tidbits.
for (const who of ['self', 'child', 'family', 'friend', 'work', 'ally', null]) {
  const action = communityAction(who)
  assert.equal(action.href, '/go/servicehub?next=/community')
  assert.ok(action.text.length > 20)
}
assert.match(communityAction('child').text, /parents/)
console.log('firstWeeks: ok')
