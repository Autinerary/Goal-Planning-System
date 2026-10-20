// Run from frontend/: node --experimental-strip-types lib/goalCategories.test.mjs
import assert from 'node:assert/strict'
import { DIMENSION_FOR_AREA, goalAreas, goalsForDimension, guessGoalArea, isArea } from './goalCategories.ts'
import { hiddenGoalSet, withoutHiddenGoals } from './hiddenGoals.ts'

// ── Each goal under its own area only ──
assert.equal(guessGoalArea('Graduate University'), 'education')
assert.equal(guessGoalArea('Get a job'), 'career')
assert.equal(guessGoalArea('Make two new friends'), 'relationships')
assert.equal(guessGoalArea('Eat healthier'), 'health')
assert.equal(guessGoalArea('Self-advocacy skills'), 'barrier')
assert.equal(guessGoalArea('Travel to Japan'), 'other')
assert.equal(guessGoalArea('Learn a new language'), 'education')
assert.equal(guessGoalArea('Learn to cook'), 'other')
assert.ok(isArea('career') && !isArea('workplace') && !isArea(3))
assert.equal(DIMENSION_FOR_AREA.career, 'workplace')

const goals = ['Graduate University', 'Get a job', 'Learn to cook']
// The saved choice wins, then setup's (this browser), then the words.
const areas = goalAreas(goals, { 'Learn to cook': 'health', 'Get a job': 'bogus' }, { career: [{ goal: 'get a job ' }], education: ['Graduate University'] })
assert.deepEqual(areas, { 'Graduate University': 'education', 'Get a job': 'career', 'Learn to cook': 'health' })
assert.deepEqual(goalAreas(['Graduate University'], null, null), { 'Graduate University': 'education' })
assert.deepEqual(goalsForDimension(goals, areas, 'education'), ['Graduate University'])
assert.deepEqual(goalsForDimension(goals, areas, 'workplace'), ['Get a job'])
assert.deepEqual(goalsForDimension(goals, areas, 'relationships'), [])
assert.deepEqual(goalsForDimension(['Travel'], { Travel: 'other' }, 'barrier'), [])

// ── A goal taken out is hidden everywhere, and kept ──
const plan = {
  userProfile: { goals: ['Graduate'], hiddenGoals: [' Get a job '] },
  races: [
    { id: 'r0', name: 'Graduate', goal: 'Graduate', milestones: [{ id: 'm1', goal: 'Graduate' }] },
    { id: 'r1', name: 'Get a job', goal: 'Get a job', milestones: [{ id: 'm2', goal: 'Get a job' }] },
  ],
  agentResponses: [
    { agentId: 'path_planning', result: { milestones: [{ id: 'm1', goal: 'Graduate' }, { id: 'm2', goal: 'get a job' }], tasks: [{ id: 't1', milestoneId: 'm1' }, { id: 't2', milestoneId: 'm2' }] } },
    { agentId: 'tool_recommendation', result: { recommendations: { m1: [{ name: 'A' }], m2: [{ name: 'B' }] } } },
    { agentId: 'calendar_optimization', result: { schedule: [{ day: 'Mon', tasks: [{ id: 't1', milestoneId: 'm1' }, { id: 't2', milestoneId: 'm2' }] }] } },
    { agentId: 'pattern_recognition', result: { x: 1 } },
  ],
}
assert.deepEqual([...hiddenGoalSet(plan)], ['get a job'])
const shown = withoutHiddenGoals(plan)
assert.deepEqual(shown.races.map((r) => r.id), ['r0'])
const res = Object.fromEntries(shown.agentResponses.map((r) => [r.agentId, r.result]))
assert.deepEqual(res.path_planning.milestones.map((m) => m.id), ['m1'])
assert.deepEqual(res.path_planning.tasks.map((t) => t.id), ['t1'])
assert.deepEqual(Object.keys(res.tool_recommendation.recommendations), ['m1'])
assert.deepEqual(res.calendar_optimization.schedule[0].tasks.map((t) => t.id), ['t1'])
assert.deepEqual(res.pattern_recognition, { x: 1 })
// The stored plan itself is untouched (nothing deleted).
assert.equal(plan.races.length, 2)
assert.equal(plan.agentResponses[0].result.milestones.length, 2)
// Nothing hidden: the same object back.
const plain = { races: [], userProfile: {} }
assert.equal(withoutHiddenGoals(plain), plain)
assert.equal(withoutHiddenGoals(null), null)
console.log('goalCategories: ok')
