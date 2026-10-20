// Run from frontend/: node --experimental-strip-types lib/patterns.test.mjs
import assert from 'node:assert/strict'
import { bucketsFrom, dailyPattern, weeklyPattern, monthlyPattern, bestDays, energyByWeekday, listOf, total, hourLabel } from './patterns.ts'
import { tickPlanTask, doneThisWeek } from './planTaskDone.ts'

const today = new Date(2026, 9, 20, 15) // Tuesday 20 October 2026
// Plan ticks by hour, your own tasks and milestones, all as things done.
const b = bucketsFrom({
  doneHours: {
    '2026-10-06': { 9: 2, 10: 1 }, // Tuesday morning
    '2026-10-13': { 10: 3 },       // Tuesday morning
    '2026-10-15': { 19: 1 },       // Thursday evening
    'nonsense': { 9: 4 },
    '2026-10-16': { 30: 2, 8: 0 },
  },
  ownDone: [new Date(2026, 9, 20, 9, 30)],      // Tuesday morning
  milestonesDone: [new Date(2026, 9, 17, 14)], // Saturday afternoon
})
assert.equal(total(b), 9)

// Daily: mornings, and the busiest hour.
const day = dailyPattern(b)
assert.deepEqual(day.bestParts, ['Morning'])
assert.equal(day.peakHour, 10)
assert.equal(day.parts.find((p) => p.id === 'evening').count, 1)

// Weekly: Tuesdays, averaged over the Tuesdays there have been (3 since 6 October).
const week = weeklyPattern(b, today)
assert.deepEqual(week.best, ['Tuesday'])
assert.equal(week.days[1].count, 7)
assert.equal(week.days[1].perWeek, 2.3)
assert.equal(week.days[3].perWeek, 0.5) // two Thursdays, one thing

// Monthly: the weeks of the month, and the last six months.
const month = monthlyPattern(b, today)
assert.deepEqual(month.weeks.map((w) => w.count), [3, 3, 3, 0, 0])
assert.deepEqual(month.bestWeeks, ['1st to 7th', '8th to 14th', '15th to 21st'])
assert.deepEqual(month.months.map((m) => m.label), ['May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026'])
assert.equal(month.months[5].count, 9)

// Best days: weekdays, part of the day, the best date so far (latest of a tie), days active lately.
const best = bestDays(b, today)
assert.deepEqual(best.weekdays, ['Tuesday'])
assert.deepEqual(best.date, { date: '2026-10-13', count: 3 })
assert.equal(best.activeDays30, 5)
// Ties are all named.
assert.deepEqual(weeklyPattern(bucketsFrom({ doneHours: { '2026-10-19': { 9: 1 }, '2026-10-20': { 9: 1 } } }), today).best, ['Monday', 'Tuesday'])
assert.equal(listOf(['Monday', 'Tuesday', 'Friday']), 'Monday, Tuesday and Friday')
assert.equal(hourLabel(0), '12 am'); assert.equal(hourLabel(12), '12 pm'); assert.equal(hourLabel(15), '3 pm')
// Nothing done: nothing best.
assert.deepEqual(bestDays([], today).weekdays, [])

// The energy chosen through the week.
const energy = energyByWeekday({ '2026-10-13': 'best', '2026-10-20': 'best', '2026-10-19': 'worst', bad: 'best', '2026-10-18': 'loud' })
assert.equal(energy.chosen, 3)
assert.deepEqual(energy.highDays, ['Tuesday'])
assert.deepEqual(energy.lowDays, ['Monday'])

// Ticking a plan task keeps its hour; unticking takes that one back.
const at = new Date(2026, 9, 20, 9, 15)
let prefs = {}
prefs = { ...prefs, ...tickPlanTask(prefs, 't1', at) }
assert.ok(doneThisWeek(prefs.planTaskDone, at).has('t1'))
assert.deepEqual(prefs.doneHours, { '2026-10-20': { 9: 1 } })
prefs = { ...prefs, ...tickPlanTask(prefs, 't2', new Date(2026, 9, 20, 9, 40)) }
assert.deepEqual(prefs.doneHours, { '2026-10-20': { 9: 2 } })
const later = new Date(2026, 9, 20, 18)
const off = tickPlanTask(prefs, 't1', later)
assert.equal(off.done, false)
assert.deepEqual(off.doneHours, { '2026-10-20': { 9: 1 } }) // its own 9 o'clock, not 6 pm
assert.equal(off.planTaskAt.t1, undefined)
const none = tickPlanTask(off, 't2', later)
assert.deepEqual(none.doneHours, {})
console.log('patterns: ok')
