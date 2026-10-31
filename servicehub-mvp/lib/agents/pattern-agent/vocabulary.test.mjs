// Run from servicehub-mvp/: node --experimental-strip-types lib/agents/pattern-agent/vocabulary.test.mjs
import assert from 'node:assert/strict'
import { conditionOf, conditionsOf, combinationsOf } from './vocabulary.ts'

// The same condition, as it was stored four ways, is one name.
for (const [category, type] of [['neurodivergence', 'autism'], ['general', 'Autism'], ['general', 'Autism spectrum disorder'], ['general', 'ASD']]) {
  assert.equal(conditionOf(category, type), 'autism', `${category}:${type}`)
}
assert.equal(conditionOf('neurodivergence', 'ADHD'), 'adhd')
assert.equal(conditionOf('neurodivergence', 'adhd'), 'adhd')
assert.equal(conditionOf('general', 'Anxiety disorders'), 'anxiety')
assert.equal(conditionOf('mental_health', 'anxiety'), 'anxiety')
assert.equal(conditionOf('general', 'Obsessive-compulsive and related conditions'), 'ocd')
assert.equal(conditionOf('general', 'Immigrant / Refugee'), 'newcomer')
assert.equal(conditionOf('general', 'Limited Income'), 'low income')
assert.equal(conditionOf('socioeconomic', 'low_income'), 'low income')
assert.equal(conditionOf('disability', 'hearing_impairment'), 'hearing')
assert.equal(conditionOf('general', 'LGBTQ+'), 'lgbtq')
// Answers that name no condition are not counted.
for (const t of ['Prefer not to share', 'No current barriers', '', null, undefined]) assert.equal(conditionOf('general', t), null)
// An unknown label keeps its own words (not a guess).
assert.equal(conditionOf('general', 'Synesthesia'), 'synesthesia')
// A person: distinct, sorted, the two spellings of one condition counted once.
assert.deepEqual(
  conditionsOf([{ barrier_category: 'general', barrier_type: 'ADHD' }, { barrier_category: 'neurodivergence', barrier_type: 'adhd' },
                { barrier_category: 'general', barrier_type: 'Autism spectrum disorder' }, { barrier_category: 'general', barrier_type: 'Prefer not to share' }]),
  ['adhd', 'autism'])
// Pairs and triples.
assert.deepEqual(combinationsOf(['a', 'b']), ['a|b'])
assert.deepEqual(combinationsOf(['a', 'b', 'c']).sort(), ['a|b', 'a|b|c', 'a|c', 'b|c'])
assert.deepEqual(combinationsOf(['a']), [])
assert.equal(combinationsOf(['a', 'b', 'c', 'd', 'e']).filter((k) => k.split('|').length > 3).length, 0)
console.log('pattern vocabulary: ok')
