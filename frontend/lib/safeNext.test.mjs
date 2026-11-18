// node --experimental-strip-types lib/safeNext.test.mjs
import assert from 'node:assert/strict'
import { safeNextPath } from './safeNext.ts'

// Ordinary paths on this site come back as they are.
assert.equal(safeNextPath('/path'), '/path')
assert.equal(safeNextPath('/milestones/abc?then=rate#tools'), '/milestones/abc?then=rate#tools')

// Anything that leaves the site is refused, however it's disguised.
for (const bad of [
  '//evil.example',
  '/\\evil.example',
  '/\t/evil.example',
  '/\n/evil.example',
  '/\r\n/evil.example',
  '/%09/evil.example'.replace('%09', '\t'),
  'https://evil.example',
  'evil.example',
  '/.//evil.example',
  '/./\\evil.example',
  '/a/..//evil.example',
  'javascript:alert(1)',
  '',
  null,
  undefined,
  42,
]) {
  assert.equal(safeNextPath(bad), null, JSON.stringify(bad))
}

// Too long.
assert.equal(safeNextPath('/' + 'a'.repeat(600)), null)
assert.equal(safeNextPath('/' + 'a'.repeat(50), 20), null)

// An encoded tab stays encoded, so it stays on this site.
assert.equal(safeNextPath('/%09/evil.example'), '/%09/evil.example')

console.log('safeNext: ok')
