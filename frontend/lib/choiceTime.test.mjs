// Run from frontend/: node --experimental-strip-types lib/choiceTime.test.mjs
import assert from 'node:assert/strict'
import { isLastWeek, monthName, previousMonth, torontoDate, torontoMonth, votingOpen } from './choiceTime.ts'

// Toronto's date, not UTC's: 23:30 on 31 October in Toronto is 03:30 UTC on 1 November.
assert.equal(torontoDate(new Date('2026-11-01T03:30:00Z')), '2026-10-31')
assert.equal(torontoMonth(new Date('2026-11-01T03:30:00Z')), '2026-10')
assert.equal(torontoMonth(new Date('2026-11-01T05:00:00Z')), '2026-11')

// The newsletter's Mondays: the last one of the month carries the vote.
assert.equal(isLastWeek('2026-10-19'), false)
assert.equal(isLastWeek('2026-10-26'), true)    // the next Monday is 2 November
assert.equal(isLastWeek('2026-11-23'), false)   // 30 November is still November
assert.equal(isLastWeek('2026-11-30'), true)
assert.equal(isLastWeek('2026-12-28'), true)
assert.equal(isLastWeek('2027-02-22'), true)    // February 2027 has 28 days
assert.equal(isLastWeek('2028-02-22'), false)   // 2028 is a leap year: 29 February is a Tuesday

// Voting is open in the month's last week only, in that month.
assert.equal(votingOpen('2026-10', new Date('2026-10-26T14:00:00Z')), true)
assert.equal(votingOpen('2026-10', new Date('2026-10-31T23:00:00Z')), true)    // 19:00 in Toronto, 31 October
assert.equal(votingOpen('2026-10', new Date('2026-11-01T05:00:00Z')), false)   // 1 November in Toronto
assert.equal(votingOpen('2026-10', new Date('2026-10-20T14:00:00Z')), false)
assert.equal(votingOpen('2026-11', new Date('2026-10-26T14:00:00Z')), false)

assert.equal(previousMonth('2026-11'), '2026-10')
assert.equal(previousMonth('2027-01'), '2026-12')
assert.equal(monthName('2026-10'), 'October')
assert.equal(monthName('2026-10', true), 'October 2026')
console.log('choiceTime: ok')
