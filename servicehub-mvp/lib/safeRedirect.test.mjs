// Run from servicehub-mvp/: node --experimental-strip-types lib/safeRedirect.test.mjs
// Where people go after signing in stays on this site (bug audit, 17 November 2026, item 7).
import assert from 'node:assert/strict'
import { safeSameSitePath } from './safeRedirect.ts'

// Another site, however it is written.
for (const bad of [
  '/\t/evil.example',
  '/\\evil.example',
  '//evil.example',
  '/\n/evil.example',
  '/\r/evil.example',
  '/\\\\evil.example',
  '/..//evil.example',
  '/.//evil.example',
  '/a/..//evil.example',
  '/a/../..//evil.example',
  'https://evil.example',
  'http:evil.example',
  'javascript:alert(1)',
  'evil.example',
  '',
  null,
  undefined,
]) {
  assert.equal(safeSameSitePath(bad), null, JSON.stringify(bad))
}

// Paths on this site keep their query and fragment.
assert.equal(safeSameSitePath('/'), '/')
assert.equal(safeSameSitePath('/resources/123?then=save'), '/resources/123?then=save')
assert.equal(safeSameSitePath('/community/post/abc#answers'), '/community/post/abc#answers')
// An encoded tab stays encoded: a path on this site, not another site.
assert.equal(safeSameSitePath('/%09/evil.example'), '/%09/evil.example')

console.log('safeRedirect: all passed')
