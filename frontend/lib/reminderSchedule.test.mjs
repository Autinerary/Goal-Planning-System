// When a daily reminder is due (lib/reminderSchedule.ts), with the "first two
// weeks" end date. Run from frontend/:
//   node --experimental-strip-types lib/reminderSchedule.test.mjs
import assert from 'node:assert/strict'
import { reminderDue, firstWeeksEnd } from './reminderSchedule.ts'

const rem = { enabled: true, consent: true, time: '09:00', timeZone: 'America/Toronto' }
// 9 AM in Toronto on 12 October 2026 is 13:00 UTC.
const nine = new Date('2026-10-12T13:00:00Z')
assert.equal(reminderDue(rem, undefined, nine), '2026-10-12')
assert.equal(reminderDue(rem, '2026-10-12', nine), null) // already sent today
assert.equal(reminderDue({ ...rem, consent: false }, undefined, nine), null)

// With an end date: sent on the last day, not after it.
assert.equal(reminderDue({ ...rem, until: '2026-10-12' }, undefined, nine), '2026-10-12')
assert.equal(reminderDue({ ...rem, until: '2026-10-11' }, undefined, nine), null)
assert.equal(reminderDue({ ...rem, until: 'not a date' }, undefined, nine), '2026-10-12')

// The first two weeks end 14 days after the account was made, where they live.
assert.equal(firstWeeksEnd('2026-10-12T15:00:00Z', 'America/Toronto'), '2026-10-26')
assert.equal(firstWeeksEnd('2026-10-12T02:00:00Z', 'America/Toronto'), '2026-10-25') // still the 11th in Toronto
assert.equal(firstWeeksEnd('nonsense', 'America/Toronto', new Date('2026-10-01T12:00:00Z')), '2026-10-15')

console.log('reminderSchedule: all passed')
