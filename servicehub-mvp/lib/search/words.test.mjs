// Run from servicehub-mvp/: node --experimental-strip-types lib/search/words.test.mjs
// What someone types can't change a search's filter (bug audit, 17 November 2026, item 33).
import assert from 'node:assert/strict'
import { orIlikeValue } from './words.ts'

// Plain words: quoted, matched anywhere.
assert.equal(orIlikeValue('therapy'), '"%therapy%"')

// LIKE's wildcards and the backslash match themselves (escaped for LIKE, then for the quotes).
assert.equal(orIlikeValue('100%_off'), '"%100\\\\%\\\\_off%"')
assert.equal(orIlikeValue('a\\b'), '"%a\\\\\\\\b%"')

// Commas, brackets, dots and colons stay inside the quotes, so they can't end the filter or add one.
for (const typed of ['a,b', 'x),id.neq.(y', 'name.eq.x', 'a:b']) {
  const v = orIlikeValue(typed)
  assert.ok(v.startsWith('"%') && v.endsWith('%"'), v)
  // The only quote characters are the outer pair.
  assert.equal(v.slice(1, -1).includes('"'), false, v)
}

// A quote inside is escaped, so it can't close the value early.
assert.equal(orIlikeValue('say "hi"'), '"%say \\"hi\\"%"')

console.log('search words: ok')
