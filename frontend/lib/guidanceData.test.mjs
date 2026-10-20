// Run from frontend/: node --experimental-strip-types lib/guidanceData.test.mjs
import assert from 'node:assert/strict'
import { guidanceComplete, guidanceFor, guidanceSource } from './guidanceData.ts'

const stored = {
  m1: { name: 'Ask for accommodations', avoid: ['a', 'b', 'c', 'd', 'e', 'f'], tips: ['t', 3], source: 'ai' },
  m2: { name: 'Old name', avoid: ['x'], tips: [] },
  m3: { name: 'Empty', avoid: [], tips: ['t'] },
}
assert.deepEqual(guidanceFor(stored, 'm1', 'Ask for accommodations'), {
  name: 'Ask for accommodations', avoid: ['a', 'b', 'c', 'd', 'e'], tips: ['t'], source: 'ai',
})
// Renamed since, or nothing to avoid: none yet.
assert.equal(guidanceFor(stored, 'm2', 'New name'), null)
assert.equal(guidanceFor(stored, 'm3', 'Empty'), null)
assert.equal(guidanceFor(stored, 'nope'), null)
assert.equal(guidanceFor(null, 'm1'), null)
// Anything not 'ai' says it is general advice.
assert.equal(guidanceFor(stored, 'm2').source, 'general')
assert.ok(guidanceComplete(stored, [{ id: 'm1', name: 'Ask for accommodations' }]))
assert.ok(!guidanceComplete(stored, [{ id: 'm1', name: 'Ask for accommodations' }, { id: 'm4', name: 'x' }]))
assert.match(guidanceSource({ source: 'ai' }), /AI/)
assert.match(guidanceSource({ source: 'general' }), /General advice/)
console.log('guidanceData: ok')
