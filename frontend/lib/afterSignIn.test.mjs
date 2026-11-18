// Run from frontend/: node --experimental-strip-types lib/afterSignIn.test.mjs
//
// A link opened signed out keeps its page through sign-in (lib/afterSignIn.ts): only a page of this site, and never a
// sign-in or setup page, which would send people round again.
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(
  'export async function resolve(s, c, next) { try { return await next(s, c) } catch (e) { ' +
  'if (s.startsWith(".") && !/\\.[a-z]+$/.test(s)) return next(s + ".ts", c); throw e } }'))
const { afterSignInPath, loginHrefFor } = await import('./afterSignIn.ts')

// Pages of the app come back as they are, with their query and hash.
assert.equal(afterSignInPath('/milestones/m1'), '/milestones/m1')
assert.equal(afterSignInPath('/calendar?view=timeblock#today'), '/calendar?view=timeblock#today')

// Anything that leaves the site, or isn't a path, is refused.
for (const bad of ['//evil.example', '/\\evil.example', '/\t/evil.example', 'https://evil.example/path', 'javascript:alert(1)', '', null, undefined, 42]) {
  assert.equal(afterSignInPath(bad), null, String(bad))
}

// Sign-in, sign-up and setup pages are not somewhere to go back to.
for (const loop of ['/', '/login', '/login?next=/path', '/signup', '/onboarding', '/auth/age', '/reset-password', '/login/']) {
  assert.equal(afterSignInPath(loop), null, loop)
}

// The sign-in page's address keeps the page, encoded.
assert.equal(loginHrefFor('/milestones/m1?x=1'), '/login?next=%2Fmilestones%2Fm1%3Fx%3D1')
assert.equal(loginHrefFor('/path'), '/login?next=%2Fpath')
assert.equal(loginHrefFor('/login'), '/login')
assert.equal(loginHrefFor('//evil.example'), '/login')
console.log('afterSignIn: ok')
