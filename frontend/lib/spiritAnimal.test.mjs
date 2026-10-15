// Today's guide on the Path (lib/spiritAnimal.ts). Plain JS so the app's type
// check leaves it alone. Run from frontend/:
//   node --experimental-strip-types lib/spiritAnimal.test.mjs
import assert from 'node:assert/strict'
import { isDefaultEnergy, paceForToday, selectTodaysAnimal } from './spiritAnimal.ts'

const FRIDAY = new Date(2026, 9, 16, 12)   // Friday 16 October 2026
const TUESDAY = new Date(2026, 9, 13, 12)  // Tuesday 13 October 2026
const fastSlow = [{ type: 'wolf', color: 'grey' }, { type: 'turtle', color: 'green' }]

// A schedule as Calendar Optimization stores it: energy from the weekday.
const weekdaySchedule = (source) => [
  { dayName: 'Tuesday', type: 'high_energy', energyLevel: 'high', ...(source ? { energySource: source } : {}) },
  { dayName: 'Friday', type: 'recovery', energyLevel: 'low', ...(source ? { energySource: source } : {}) },
]

// The pace still follows the schedule.
assert.equal(paceForToday(weekdaySchedule('weekday'), FRIDAY), 'slow')
assert.equal(paceForToday(weekdaySchedule('weekday'), TUESDAY), 'fast')

// But the label says it is the weekday's default, not the person's day.
for (const source of ['weekday', undefined]) {   // older schedules have no source: also weekday
  const friday = selectTodaysAnimal(fastSlow, 'fastSlow', weekdaySchedule(source), FRIDAY)
  assert.equal(friday.animal.type, 'turtle')
  assert.equal(friday.label, 'Slow day (default for Fridays)')
  const tuesday = selectTodaysAnimal(fastSlow, 'fastSlow', weekdaySchedule(source), TUESDAY)
  assert.equal(tuesday.animal.type, 'wolf')
  assert.equal(tuesday.label, 'Fast day (default for Tuesdays)')
}

// The bipolar rules make every day flexible: a default too, not by weekday.
const flexible = [{ dayName: 'Friday', type: 'balanced', energyLevel: 'flexible', energySource: 'condition' }]
assert.equal(selectTodaysAnimal(fastSlow, 'fastSlow', flexible, FRIDAY).label, 'Fast day (default)')

// Only a source that is the person's own drops "default". None exists yet.
assert.equal(isDefaultEnergy({ energySource: 'weekday' }), true)
assert.equal(isDefaultEnergy({}), true)
assert.equal(isDefaultEnergy({ energySource: 'person' }), false)
assert.equal(selectTodaysAnimal(fastSlow, 'fastSlow', weekdaySchedule('person'), FRIDAY).label, 'Slow Day')

// The other modes are unchanged.
const week = Array.from({ length: 7 }, (_, i) => ({ type: `a${i}`, color: 'x' }))
assert.equal(selectTodaysAnimal(week, 'weekly', weekdaySchedule('weekday'), FRIDAY).label, 'Friday')
assert.equal(selectTodaysAnimal([fastSlow[0]], 'general', weekdaySchedule('weekday'), FRIDAY).label, 'Your guide')
assert.equal(selectTodaysAnimal([], 'fastSlow', weekdaySchedule('weekday'), FRIDAY), null)
// No schedule: no claim about the day at all.
assert.equal(selectTodaysAnimal(fastSlow, 'fastSlow', [], FRIDAY).label, 'Your guide')

console.log('spiritAnimal: ok')
