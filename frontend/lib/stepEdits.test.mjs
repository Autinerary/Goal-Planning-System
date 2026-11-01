// Run from frontend/: node --experimental-strip-types lib/stepEdits.test.mjs
//
// A step in the person's own words (lib/stepEdits.ts): changed in every copy the plan keeps, the planner's version
// kept from the first edit, put back by "Use the original", and nothing else in the plan touched.
import assert from 'node:assert/strict'
import { cleanStepText, stepCopies, withStepEdit, withStepRestored } from './stepEdits.ts'

const step = () => ({ id: 'm1', goal: 'Swim once a week', name: 'Book a pool slot', description: 'Pick a quiet time.' })
const plan = {
  path: { milestones: [step(), { id: 'm2', name: 'Pack a bag' }] },
  races: [{ id: 'race_0', milestones: [step()] }, { id: 'race_1', milestones: [{ id: 'm3', name: 'Other' }] }],
  agentResponses: [{ agentId: 'path_planning', result: { milestones: [step()] } }, { agentId: 'tool_recommendation', result: {} }],
  toolEdits: { m1: { removed: ['x'] } },
}

assert.equal(stepCopies(plan, 'm1').length, 3)
assert.equal(stepCopies(plan, 'nope').length, 0)

// Cleaning.
assert.deepEqual(cleanStepText('  Book   Tuesday 7 am ', ' My   time.\n'), { name: 'Book Tuesday 7 am', description: 'My time.' })
assert.deepEqual(cleanStepText('x', ''), { error: 'Give the step a name.' })
assert.equal(cleanStepText('a'.repeat(300), '').name.length, 120)

// Editing: every copy, the original kept from the first edit, the rest untouched.
const now = new Date('2026-10-31T12:00:00Z')
const once = withStepEdit(plan, 'm1', { name: 'Book Tuesday 7 am', description: 'The pool is quiet then.' }, now)
assert.ok(stepCopies(once, 'm1').every((m) => m.name === 'Book Tuesday 7 am' && m.description === 'The pool is quiet then.'))
assert.deepEqual(once.stepEdits.m1, { name: 'Book Tuesday 7 am', description: 'The pool is quiet then.', goal: 'Swim once a week',
  editedAt: '2026-10-31T12:00:00.000Z', original: { name: 'Book a pool slot', description: 'Pick a quiet time.' } })
assert.equal(once.path.milestones[1].name, 'Pack a bag')
assert.deepEqual(once.toolEdits, plan.toolEdits)
assert.equal(plan.path.milestones[0].name, 'Book a pool slot', 'the plan passed in is not changed')
const twice = withStepEdit(once, 'm1', { name: 'Book Wednesday', description: '' }, now)
assert.deepEqual(twice.stepEdits.m1.original, { name: 'Book a pool slot', description: 'Pick a quiet time.' }, 'still the planner’s version')
assert.equal(withStepEdit(plan, 'nope', { name: 'X y', description: '' }), null)

// Putting the planner's version back.
const back = withStepRestored(twice, 'm1')
assert.ok(stepCopies(back, 'm1').every((m) => m.name === 'Book a pool slot' && m.description === 'Pick a quiet time.'))
assert.equal(back.stepEdits.m1, undefined)
assert.equal(withStepRestored(plan, 'm1'), null)

console.log('step edits: ok')
