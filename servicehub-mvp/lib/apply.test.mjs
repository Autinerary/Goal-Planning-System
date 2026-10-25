// Run from servicehub-mvp/: node --experimental-strip-types lib/apply.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applicationLabel, applyHref, canApplyTo } from './apply.ts'

// Places you just go to have no Apply, and the list is the app's own.
assert.equal(canApplyTo('Therapist'), true)
assert.equal(canApplyTo('Café'), false)
assert.equal(canApplyTo(' Park '), false)
assert.equal(canApplyTo(null), true)
const places = (file) => {
  const m = readFileSync(new URL(file, import.meta.url), 'utf8').match(/const PLACES = new Set\(\s*\[([^\]]*)\]/)
  assert.ok(m, `no PLACES list in ${file}`)
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
}
assert.deepEqual(places('./apply.ts'), places('../../frontend/lib/applications.ts'), 'the same places as the app (frontend/lib/applications.ts)')

assert.match(applyHref('abc'), /\/apply\/abc$/)
assert.equal(applicationLabel('sent', '2026-10-26T15:00:00Z'), 'Applied Oct 26')
assert.match(applicationLabel('waiting', null), /finding their email address/)
assert.match(applicationLabel('unreachable', null), /couldn’t reach them/)
assert.equal(applicationLabel('cancelled', null), '')
console.log('apply: all passed')
