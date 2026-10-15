// The starter kits for parents (lib/starterKits.ts, Riipen Labs Group 24). Run from frontend/:
//   node --experimental-strip-types lib/starterKits.test.mjs
import assert from 'node:assert/strict'
import { STARTER_KITS, starterKit, kitDate, KIT_AUDIENCES } from './starterKits.ts'
import { orderForAnswers, REFINE_QUESTIONS, refineQuestionsFor, PATHWAY_ITEM_IDS, suggestedStart, START_GOALS } from './startHere.ts'

assert.deepEqual(STARTER_KITS.map((k) => k.id), ['assessment', 'school'])
for (const kit of STARTER_KITS) {
  assert.ok(kit.steps.length >= 5, kit.id)
  assert.ok(kit.places.length >= 2, kit.id)
  // Every kit names where its facts come from: official pages only.
  assert.ok(kit.sources.length >= 2, kit.id)
  for (const src of kit.sources) assert.match(src.href, /^https:\/\/(www\.ontario\.ca|accessoap\.ca)\//, src.href)
  for (const step of kit.steps) if (step.link) assert.match(step.link.href, /^https:\/\//, step.link.href)
  assert.match(kit.checked, /^\d{4}-\d{2}-\d{2}$/)
  // "Reviewed by" appears only once a real person has reviewed it.
  assert.equal(kit.review, undefined, `${kit.id}: add a review only when one has happened`)
  for (const text of [kit.title, kit.summary, ...kit.steps.flatMap((s) => [s.title, s.body])]) {
    assert.doesNotMatch(text, /\bbarriers?\b/i, 'The app says norms, never barrier')
  }
}
assert.equal(starterKit('school').title, 'Support at school and an IEP in Ontario')
assert.equal(starterKit('nope'), undefined)
assert.equal(kitDate('2026-10-12'), '12 October 2026')
assert.ok(KIT_AUDIENCES.has('child') && !KIT_AUDIENCES.has('self'))

// Start here's optional questions (Group 21) reorder, never drop.
const items = ['autism', 'therapists', 'tidbits', 'book'].map((id) => ({ id }))
assert.deepEqual(orderForAnswers(items, {}).map((i) => i.id), ['autism', 'therapists', 'tidbits', 'book'])
assert.deepEqual(orderForAnswers(items, { how: 'talk' }).map((i) => i.id), ['tidbits', 'autism', 'therapists', 'book'])
assert.deepEqual(orderForAnswers(items, { soon: 'today' }).map((i) => i.id), ['therapists', 'autism', 'tidbits', 'book'])
assert.equal(orderForAnswers(items, { how: 'read', soon: 'exploring' }).length, 4)
assert.equal(REFINE_QUESTIONS.length, 4)
// For yourself three, with the two first questions Group 21's five; for someone
// supporting another person, their age first (Group 12).
assert.deepEqual(refineQuestionsFor('self').map((q) => q.id), ['where', 'soon', 'how'])
assert.deepEqual(refineQuestionsFor('child').map((q) => q.id), ['age', 'where', 'soon', 'how'])
assert.ok(PATHWAY_ITEM_IDS.includes('kit_assessment') && PATHWAY_ITEM_IDS.includes('kit_school'))
// A parent's needs from setup lead to the right starter resources.
assert.equal(suggestedStart('child', ['school']).need, 'school_work')
assert.equal(suggestedStart('child', ['assessment']).need, 'services')
assert.equal(suggestedStart('self', ['urgent']).need, 'urgent')
assert.ok(START_GOALS.some((g) => g.id === 'urgent'))

console.log('starterKits: all passed')
