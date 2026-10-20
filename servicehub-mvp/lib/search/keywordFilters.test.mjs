// Run from servicehub-mvp/: node --experimental-strip-types lib/search/keywordFilters.test.mjs
import assert from 'node:assert/strict'
import { ACTIVITIES, isActivity, keywordGroupsFor, therapyWords } from './keywordFilters.ts'

assert.deepEqual(ACTIVITIES.map((a) => a.label), ['Swimming', 'Horseback Riding', 'Animal Therapy'])
assert.ok(isActivity('swimming') && !isActivity('skiing'))
// One group for activities, one for therapy; nothing for unknown ids.
assert.deepEqual(keywordGroupsFor([], []), [])
assert.deepEqual(keywordGroupsFor(['bogus'], ['bogus']), [])
const g = keywordGroupsFor(['swimming', 'horseback'], ['aba', 'occupational'])
assert.equal(g.length, 2)
assert.ok(g[0].includes('swim') && g[0].includes('equestrian'))
assert.deepEqual(g[1], ['applied behaviour analysis', 'applied behavior analysis', 'aba therapy', 'aba services', 'occupational therap'])
// No bare acronyms of two or three letters: they would match inside other words.
for (const words of [ ...ACTIVITIES.map((a) => a.words), ...['behavioural', 'aba', 'ibi', 'developmental', 'cbt', 'rdi', 'occupational', 'therapy_other'].map(therapyWords)]) {
  for (const w of words) assert.ok(w.length >= 4, w)
}
// Each activity finds the category of the same name too.
for (const [id, category] of [['swimming', 'swimming'], ['horseback', 'horseback riding'], ['animal_therapy', 'animal therapy']]) {
  assert.ok(ACTIVITIES.find((a) => a.id === id).words.some((w) => category.includes(w)), category)
}
// "pool" alone would find Liverpool; it's always "swimming pool".
assert.ok(!ACTIVITIES[0].words.includes('pool'))
console.log('keywordFilters: ok')
