// Run from servicehub-mvp/: node --experimental-strip-types lib/signup.test.mjs
// ResourceHub's list of places (no Sign me up or request) must be the app's own.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const places = (file) => {
  const m = readFileSync(new URL(file, import.meta.url), 'utf8').match(/const PLACES = new Set\(\s*\[([^\]]*)\]/)
  assert.ok(m, `no PLACES list in ${file}`)
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
}
assert.deepEqual(places('./signup.ts'), places('../../frontend/lib/requests.ts'), 'the same places as the app (frontend/lib/requests.ts)')
console.log('signup: all passed')
