// Run from frontend/: node --experimental-strip-types lib/raceRoads.test.mjs
import assert from 'node:assert/strict'
import { raceRoads } from './raceRoads.ts'

const step = (id, goal, raceId) => ({ id, goal, raceId })

// One goal: one race, all its steps.
let all = [step('a1', 'Learn a new language', 'race_0'), step('a2', 'Learn a new language', 'race_0')]
let r = raceRoads(all, all, { goals: ['Learn a new language'], races: [{ id: 'race_0', name: 'Learn a new language' }] })
assert.deepEqual(r.map((x) => [x.name, x.steps.length, x.later]), [['Learn a new language', 2, 0]])

// The case that broke (20 October 2026): two goals, a race list with one race
// matching neither, and race ids the race list doesn't have. Still two races.
all = [
  step('a1', 'Run a 5k', 'race_0'), step('a2', 'Run a 5k', 'race_0'),
  step('b1', 'Get a part-time job', 'race_1'), step('b2', 'Get a part-time job', 'race_1'), step('b3', 'Get a part-time job', 'race_1'),
]
r = raceRoads(all, all, { goals: ['run a 5K', 'Get a part-time job'], races: [{ id: 'race_x', name: 'Main Goal' }] })
assert.deepEqual(r.map((x) => [x.name, x.steps.length]), [['run a 5K', 2], ['Get a part-time job', 3]])

// Areas not open yet: counted as to come; a race with none visible is still listed.
r = raceRoads(all, all.slice(0, 2), { goals: ['Run a 5k', 'Get a part-time job'] })
assert.deepEqual(r.map((x) => [x.name, x.steps.length, x.later]), [['Run a 5k', 2, 0], ['Get a part-time job', 0, 3]])

// Steps with no goal text: grouped by race id, named from the race list.
all = [step('a1', '', 'race_0'), step('b1', '', 'race_1')]
r = raceRoads(all, all, { races: [{ id: 'race_0', name: 'Cook dinner twice a week' }] })
assert.deepEqual(r.map((x) => x.name), ['Cook dinner twice a week', 'Race 2'])

// Nothing at all to group by: one race.
r = raceRoads([{ id: 'x' }, { id: 'y' }], [{ id: 'x' }, { id: 'y' }], { goals: ['Feel calmer'] })
assert.deepEqual(r.map((x) => [x.name, x.steps.length]), [['Feel calmer', 2]])

// No steps: no races (the page says so).
assert.deepEqual(raceRoads([], []), [])
console.log('raceRoads: ok')
