// Run from frontend/: node --experimental-strip-types lib/tidbitQuery.test.mjs
import assert from 'node:assert/strict'
import { tidbitQuery } from './tidbitQuery.ts'

assert.equal(tidbitQuery('Set up a structured study schedule'), 'study schedule')
assert.equal(tidbitQuery('Request accommodations at school'), 'accommodations school')
assert.equal(tidbitQuery('Join a study group!'), 'study group')
assert.equal(tidbitQuery('Budgeting'), 'budgeting')
assert.equal(tidbitQuery('Do it'), 'Do it')
assert.equal(tidbitQuery(''), '')
console.log('tidbitQuery: ok')
