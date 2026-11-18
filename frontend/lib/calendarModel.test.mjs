// Run from frontend/: node --experimental-strip-types lib/calendarModel.test.mjs
//
// Moving one week's occurrence of a weekly task (Time Blocks) moves that one only (lib/calendarModel.ts): its copy,
// "<id>~<date>", is drawn on the new date, and the weekly task is still there every other week.
import assert from 'node:assert/strict'
import { movedOccurrenceId, occurrencesInRange, toISODate } from './calendarModel.ts'

const weekly = { id: 'a4', name: 'Deep work', day: 'Monday', time: '09:00', scheduledDate: null, durationMinutes: 60, priority: 'high' }
// Two weeks: Monday 16 and Monday 23 November 2026, read as local dates.
const from = new Date(2026, 10, 16)
const to = new Date(2026, 10, 29)

const before = occurrencesInRange([weekly], from, to)
assert.deepEqual(before.map((o) => toISODate(o.date)), ['2026-11-16', '2026-11-23'])
assert.ok(before.every((o) => o.recurring))

// The 16 November one is moved to Tuesday 17 at 10:30.
const copy = { ...weekly, id: movedOccurrenceId('a4', '2026-11-16'), day: 'Tuesday', time: '10:30', scheduledDate: '2026-11-17' }
assert.equal(copy.id, 'a4~2026-11-16')
const after = occurrencesInRange([weekly, copy], from, to)
assert.deepEqual(after.map((o) => [o.task.id, toISODate(o.date), o.recurring]), [
  ['a4~2026-11-16', '2026-11-17', false],
  ['a4', '2026-11-23', true],
])

// A date read as a calendar day, not midnight UTC (the evening before in the Americas).
assert.equal(toISODate(occurrencesInRange([copy], new Date(2026, 10, 17), new Date(2026, 10, 17))[0].date), '2026-11-17')
console.log('calendarModel: ok')
