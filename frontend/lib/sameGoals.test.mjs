// Run from frontend/: node --experimental-strip-types lib/sameGoals.test.mjs
import assert from 'node:assert/strict'
import { alike, goalsOf } from './sameGoals.ts'

assert.ok(alike('Get a part-time job', 'Find a part-time job'))
assert.ok(alike('Learn to cook', 'Learn to cook healthy meals'))
assert.ok(alike('Graduate from college', 'graduate college'))
assert.ok(!alike('Run a 5k', 'Graduate from college'))
assert.ok(!alike('', 'Anything'))
assert.deepEqual(goalsOf({ userProfile: { goals: ['Run a 5k', { name: 'Learn to cook' }] }, races: [{ name: 'Run a 5k' }, { goal: 'Make friends' }] }), ['Run a 5k', 'Learn to cook', 'Make friends'])
assert.deepEqual(goalsOf(null), [])
console.log('sameGoals: ok')
