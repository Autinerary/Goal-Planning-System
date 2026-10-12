// The "Complete your profile" card's rules (lib/profileItems.ts). Plain JS so
// the app's type check leaves it alone. Run from frontend/:
//   node --experimental-strip-types lib/profileItems.test.mjs
import assert from 'node:assert/strict'
import { PROFILE_ITEMS, itemDone, nextProfileItem, profileProgress, profileItem } from './profileItems.ts'

const ids = PROFILE_ITEMS.map((i) => i.id)
// Seven questions, each once, each saying what it changes.
assert.deepEqual(ids, ['location', 'reminders', 'look', 'motivation', 'norms', 'character', 'spiritAnimal'])
for (const item of PROFILE_ITEMS) {
  assert.ok(item.unlocks.length > 20, item.id)
  assert.ok(item.inline || item.href, `${item.id} is answered somewhere`)
}

const empty = { hasCity: false, hasNorms: false }
assert.deepEqual(profileProgress(empty).done, [])
assert.equal(profileProgress(empty).todo.length, 7)

// What counts as answered.
assert.ok(itemDone('location', { ...empty, hasCity: true }))
assert.ok(itemDone('norms', { ...empty, hasNorms: true }))
assert.ok(!itemDone('motivation', { ...empty, motivation: { types: [] } }))
assert.ok(itemDone('motivation', { ...empty, motivation: { types: ['social'] } }))
assert.ok(itemDone('character', { ...empty, character: { hairStyle: 'curly' } }))
assert.ok(!itemDone('spiritAnimal', { ...empty, gamification: { animals: [{ type: '' }] } }))
assert.ok(itemDone('spiritAnimal', { ...empty, gamification: { animals: [{ type: 'fox' }] } }))
assert.ok(!itemDone('look', { ...empty, accessibility: { fontScale: 'default', darkMode: false } }))
assert.ok(itemDone('look', { ...empty, accessibility: { fontScale: 'large' } }))
assert.ok(itemDone('look', { ...empty, viewPreference: 'plain' }))
assert.ok(itemDone('reminders', { ...empty, reminders: { enabled: true } }))

// The next one follows the days since sign-up (Group 5's timing).
const all = profileProgress(empty).todo
assert.equal(nextProfileItem(all, 0), 'location')
assert.equal(nextProfileItem(['norms', 'character'], 3), 'norms') // none due yet: the first left
assert.equal(nextProfileItem(['motivation', 'norms'], 8), 'motivation')
assert.equal(nextProfileItem(['norms', 'character', 'spiritAnimal'], 7), 'norms')
assert.equal(nextProfileItem(['character', 'spiritAnimal'], 9), 'character')
// Reminders "for the first two weeks" are not suggested after them.
assert.equal(nextProfileItem(['reminders', 'norms'], 20), 'norms')
assert.equal(nextProfileItem(['reminders'], 20), undefined)
assert.equal(nextProfileItem([], 3), undefined)
assert.equal(profileItem('norms').href, '/profile/diagnostic')

console.log('profileItems: all passed')
