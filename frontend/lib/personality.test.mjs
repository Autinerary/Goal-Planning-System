// Run from frontend/: node --experimental-strip-types lib/personality.test.mjs
import assert from 'node:assert/strict'
import { ITEMS, TRAITS, SCALE, scoreTraits, band, profileOf, isTypeLabel } from './personality.ts'

// The Mini-IPIP: 20 items, four per trait, as the IPIP keys them.
assert.equal(ITEMS.length, 20)
for (const t of TRAITS) assert.equal(ITEMS.filter((i) => i.trait === t.id).length, 4, t.id)
assert.equal(ITEMS.filter((i) => i.keyed === -1).length, 11)   // Openness has three reversed items, the others two
assert.equal(new Set(ITEMS.map((i) => i.id)).size, 20)
assert.equal(SCALE.length, 5)

// Scoring: reversed items count the other way.
const all = (v) => Object.fromEntries(ITEMS.map((i) => [i.id, v]))
assert.deepEqual(scoreTraits(all(3)), { extraversion: 3, agreeableness: 3, conscientiousness: 3, neuroticism: 3, openness: 3 })
const outgoing = { ...all(3), e1: 5, e3: 5, e2: 1, e4: 1 }
assert.equal(scoreTraits(outgoing).extraversion, 5)
assert.equal(profileOf(outgoing).extraversion, 'high')
const quiet = { ...all(3), e1: 1, e3: 1, e2: 5, e4: 5 }
assert.equal(scoreTraits(quiet).extraversion, 1)
assert.equal(profileOf(quiet).extraversion, 'low')

// A trait needs three of its four answers; otherwise it is left out.
assert.deepEqual(Object.keys(scoreTraits({ e1: 5, e2: 1 })), [])
assert.equal(scoreTraits({ e1: 5, e2: 1, e3: 4 }).extraversion, 4.67)
assert.deepEqual(scoreTraits({ e1: 9, e2: 0, e3: 'x' }), {})

// Bands: a wide middle.
assert.equal(band(2.49), 'low')
assert.equal(band(2.5), 'middle')
assert.equal(band(3.5), 'middle')
assert.equal(band(3.51), 'high')

// A four-letter type someone adds about themselves.
assert.ok(isTypeLabel('INTJ') && isTypeLabel('enfp-t') && isTypeLabel(' ISFJ-A '))
assert.ok(!isTypeLabel('INTJ-P') && !isTypeLabel('XYZW') && !isTypeLabel(null))

console.log('personality: ok')

// Working style for the planner: from the person's own answers only.
import { workingStyleFor } from './personality.ts'
assert.equal(workingStyleFor(null), '')
assert.equal(workingStyleFor({}), '')
const quietAutistic = workingStyleFor({ extraversion: 'low' }, ['Autism'])
assert.ok(quietAutistic.includes('Recharges alone') && quietAutistic.includes('With autism and a quieter style'))
assert.ok(!workingStyleFor({ extraversion: 'low' }, []).includes('With autism'))
// A norm alone never adds anything: no personality is inferred from a norm.
assert.equal(workingStyleFor({}, ['Autism', 'ADHD']), '')
assert.ok(workingStyleFor({ conscientiousness: 'low' }, ['ADHD']).includes('15-minute pieces'))
console.log('personality working style: ok')
