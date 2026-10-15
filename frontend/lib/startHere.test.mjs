// Run from frontend/: node --experimental-strip-types lib/startHere.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { REFINE_QUESTIONS, refineQuestionsFor, answersFor, kitOrder, orderForAnswers } from './startHere.ts'

// The age question (Riipen Labs, Group 12) is asked only of people supporting
// someone, and first.
assert.deepEqual(refineQuestionsFor('self').map((q) => q.id), ['where', 'soon', 'how'])
assert.deepEqual(refineQuestionsFor('ally').map((q) => q.id), ['where', 'soon', 'how'])
for (const role of ['child', 'family', 'work']) {
  assert.deepEqual(refineQuestionsFor(role).map((q) => q.id), ['age', 'where', 'soon', 'how'], role)
}

// An age kept from another role does not count for this one.
assert.deepEqual(answersFor('self', { age: 'adult', soon: 'today' }), { soon: 'today' })
assert.deepEqual(answersFor('child', { age: 'under6', soon: 'today' }), { age: 'under6', soon: 'today' })

// The kits: the assessment first for the youngest, school support for school
// ages or a school goal, and none for 18 or older (both are about children).
const kits = ['assessment', 'school']
assert.deepEqual(kitOrder(kits, 'services', {}), ['assessment', 'school'])
assert.deepEqual(kitOrder(kits, 'services', { age: 'under6' }), ['assessment', 'school'])
assert.deepEqual(kitOrder(kits, 'services', { age: '6to12' }), ['school', 'assessment'])
assert.deepEqual(kitOrder(kits, 'learn', { age: '13to17' }), ['school', 'assessment'])
assert.deepEqual(kitOrder(kits, 'school_work', {}), ['school', 'assessment'])
assert.deepEqual(kitOrder(kits, 'services', { age: 'adult' }), [])

// The list is reordered, never cut.
const items = ['autism', 'therapists', 'doctors', 'centres'].map((id) => ({ id }))
const adult = orderForAnswers(items, { age: 'adult' }).map((i) => i.id)
assert.equal(adult[0], 'centres')
assert.deepEqual([...adult].sort(), ['autism', 'centres', 'doctors', 'therapists'])
// "How soon" still comes before age.
assert.equal(orderForAnswers(items, { soon: 'today', age: 'adult' })[0].id, 'therapists')

// Every answer can be sent as an event, and the funnel report counts it.
const funnel = readFileSync(new URL('./funnel.ts', import.meta.url), 'utf8')
const pattern = new RegExp(funnel.match(/START_REFINE_STEP = \/(.+)\/\n/)[1])
const report = readFileSync(new URL('../../backend/scripts/onboarding_funnel.py', import.meta.url), 'utf8')
for (const q of REFINE_QUESTIONS) {
  for (const o of q.options) {
    assert.ok(pattern.test(`${q.id}.${o.id}`), `${q.id}.${o.id} is a valid start_refine step`)
    assert.ok(report.includes(`("${o.id}", `), `the report names ${q.id}.${o.id}`)
  }
}

console.log('startHere: all checks passed')
