// The Path's Quick Links by role (lib/places.ts). Plain JS so the app's type
// check leaves it alone. Run from frontend/:
//   node --experimental-strip-types lib/places.test.mjs
import assert from 'node:assert/strict'
import { placesFor } from './places.ts'

const keys = (a) => placesFor(a).map((p) => p.key)

// Everyone gets eight places, no repeats.
for (const a of ['self', 'child', 'family', 'friend', 'work', 'ally', 'unsure', null, undefined, 'something new']) {
  const k = keys(a)
  assert.equal(k.length, 8, `${a}: ${k}`)
  assert.equal(new Set(k).size, 8, `${a} repeats: ${k}`)
}

// Path Market is a Quick Link now (Riipen Labs, Group 32: it took scrolling to reach).
for (const a of ['self', 'child', 'family', 'work', 'ally']) assert.ok(keys(a).includes('pathmarket'), a)

// What comes first depends on who it's for.
assert.deepEqual(keys('self').slice(0, 4), ['races', 'pitstop', 'hareworld', 'journal'])
assert.deepEqual(keys('child').slice(0, 2), ['resourcehub', 'family'])
assert.equal(placesFor('child')[0].what, 'Services for your child')
// The starter kits for parents in a parent's first four (Riipen Labs, Group 24).
assert.ok(keys('child').slice(0, 4).includes('kits'))
assert.ok(keys('family').includes('kits') && keys('work').includes('kits') && !keys('self').includes('kits'))
assert.equal(keys('work')[0], 'resourcehub')
assert.equal(keys('ally')[0], 'tidbits')
assert.ok(keys('ally').includes('help'))
assert.deepEqual(keys('friend'), keys('family'))
assert.deepEqual(keys('unsure'), keys('self'))
assert.deepEqual(keys('something new'), keys('self'))

// Only ResourceHub's places go through the hand-off.
for (const p of placesFor('self')) assert.equal(Boolean(p.hub), ['tidbits', 'resourcehub'].includes(p.key), p.key)

// The saved Start here path is named.
assert.equal(placesFor('self', { startPath: true }).find((p) => p.key === 'starter').what, 'The path you saved')
assert.equal(placesFor('self').find((p) => p.key === 'starter').what, 'Places to start')

console.log('places: all passed')
