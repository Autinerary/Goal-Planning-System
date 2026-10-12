// When a daily reminder is due (lib/reminderSchedule.ts), with the "first two
// weeks" end date. Run from frontend/:
//   node --experimental-strip-types lib/reminderSchedule.test.mjs
import assert from 'node:assert/strict'
import { reminderDue, firstWeeksEnd, setupReminderDue, snoozeUntil, addDays } from './reminderSchedule.ts'

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

// Reminders to finish setup (Groups 20 and 24). Asked at 10 AM in Toronto on 12 October.
const toronto = (local) => new Date(new Date(`${local}:00Z`).getTime() + 4 * 3_600_000) // EDT is UTC-4
const ask = { requestedAt: toronto('2026-10-12T10:00').toISOString(), timeZone: 'America/Toronto', plan: 'sequence', sends: [] }
assert.equal(setupReminderDue(ask, toronto('2026-10-12T12:00')), null) // not three hours yet
assert.equal(setupReminderDue(ask, toronto('2026-10-12T13:00')), 1) // the same-day one
assert.equal(setupReminderDue(ask, toronto('2026-10-12T21:00')), null) // never in the evening
const one = { ...ask, sends: [toronto('2026-10-12T13:00').toISOString()] }
assert.equal(setupReminderDue(one, toronto('2026-10-14T09:00')), null) // day 2
assert.equal(setupReminderDue(one, toronto('2026-10-15T08:00')), null) // day 3, too early
assert.equal(setupReminderDue(one, toronto('2026-10-15T09:00')), 2) // day 3
const two = { ...one, sends: [...one.sends, toronto('2026-10-15T09:00').toISOString()] }
assert.equal(setupReminderDue(two, toronto('2026-10-18T10:00')), null)
assert.equal(setupReminderDue(two, toronto('2026-10-19T09:00')), 3) // a week after asking
const three = { ...two, sends: [...two.sends, toronto('2026-10-19T09:00').toISOString()] }
assert.equal(setupReminderDue(three, toronto('2026-10-30T10:00')), null) // never more than three
// Snoozed, stopped, closed.
assert.equal(setupReminderDue({ ...one, snoozeUntil: '2026-10-22' }, toronto('2026-10-15T09:00')), null)
assert.equal(setupReminderDue({ ...one, snoozeUntil: '2026-10-22' }, toronto('2026-10-22T09:00')), 2)
// After a snoozed one, the next still waits three days.
const snoozedTwo = { ...one, sends: [...one.sends, toronto('2026-10-22T09:00').toISOString()], snoozeUntil: null }
assert.equal(setupReminderDue(snoozedTwo, toronto('2026-10-22T15:00')), null)
assert.equal(setupReminderDue(snoozedTwo, toronto('2026-10-25T09:00')), 3)
assert.equal(setupReminderDue({ ...ask, stoppedAt: 'x' }, toronto('2026-10-12T15:00')), null)
assert.equal(setupReminderDue({ ...ask, closedAt: 'x' }, toronto('2026-10-12T15:00')), null)
// Asked at 7 PM: the first one waits for the next morning.
const late = { ...ask, requestedAt: toronto('2026-10-12T19:00').toISOString() }
assert.equal(setupReminderDue(late, toronto('2026-10-12T20:00')), null)
assert.equal(setupReminderDue(late, toronto('2026-10-13T09:00')), 1)
// The first version's single email: 9 the next morning, once.
const old = { requestedAt: toronto('2026-10-12T10:00').toISOString(), timeZone: 'America/Toronto' }
assert.equal(setupReminderDue(old, toronto('2026-10-12T15:00')), null)
assert.equal(setupReminderDue(old, toronto('2026-10-13T09:00')), 1)
assert.equal(setupReminderDue({ ...old, sentAt: 'x' }, toronto('2026-10-14T09:00')), null)
assert.equal(snoozeUntil(toronto('2026-10-12T22:30'), 'America/Toronto', 3), '2026-10-15')
assert.equal(addDays('2026-12-30', 3), '2027-01-02')

console.log('reminderSchedule: all passed')
