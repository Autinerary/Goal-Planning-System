// Run from frontend/: node --experimental-strip-types lib/signupKit.test.mjs
import assert from 'node:assert/strict'
import { KIT_VERSION, RECIPES, recipeForUrl, runSignup } from './signupKit.ts'

assert.match(KIT_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/)
const FIELDS = new Set(['email', 'password', 'firstName', 'lastName', 'fullName'])
const OUTCOMES = new Set(['signed_up', 'check_email', 'needs_you', 'exists', 'failed'])
const regex = (s, where) => { assert.doesNotThrow(() => new RegExp(s, 'i'), where); return new RegExp(s, 'i') }
const targetOk = (t, where) => {
  if (typeof t === 'string') { assert.ok(t.trim(), where); return }
  assert.ok(t && typeof t === 'object' && (t.css || t.text), where)
  if (t.text) regex(t.text, where)
  if (t.label) regex(t.label, where)
}

assert.ok(Object.keys(RECIPES).length >= 5)
for (const [key, r] of Object.entries(RECIPES)) {
  const at = `recipe ${key}`
  // The same shape service_signups accepts (STEP 90).
  assert.match(key, /^[a-z0-9-]{2,40}$/, at)
  assert.equal(r.key, key, at)
  assert.ok(r.name, at)
  assert.ok(r.kind === 'account' || r.kind === 'newsletter', at)
  assert.equal(typeof r.robot, 'boolean', at)
  assert.ok(r.hosts.length > 0 && r.hosts.every((h) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)), at)
  // It starts on the service's own site, over https.
  assert.match(r.start, /^https:\/\//, at)
  assert.equal(recipeForUrl(r.start)?.key, key, `${at}: its start page is its own`)
  for (const u of [r.terms, r.privacy]) if (u) assert.match(u, /^https:\/\//, at)
  assert.ok(r.pages.length > 0, at)
  r.pages.forEach((p, i) => {
    const pat = `${at} page ${i + 1}`
    assert.ok(p.when.url || p.when.selector, `${pat}: says which page it is`)
    if (p.when.url) regex(p.when.url, pat)
    assert.ok(p.steps.length > 0, pat)
    for (const s of p.steps) {
      const kinds = ['fill', 'tick', 'click'].filter((k) => k in s)
      assert.equal(kinds.length, 1, `${pat}: one action per step`)
      targetOk(s.fill || s.tick || s.click, pat)
      if ('fill' in s) assert.ok(FIELDS.has(s.with), `${pat}: fills ${s.with}`)
      // Never a marketing box: only a service's terms or "consent to receive" (what a newsletter is).
      if ('tick' in s) assert.doesNotMatch(JSON.stringify(s.tick), /optin|opt-in|marketing|promo|offers/i, `${pat}: ticks no marketing box`)
    }
    const last = p.steps[p.steps.length - 1]
    assert.ok('click' in last && last.submit === true, `${pat}: ends by sending the page`)
    assert.equal(p.steps.filter((s) => 'click' in s && s.submit).length, 1, `${pat}: sends once`)
  })
  // Accounts get a password; newsletters don't ask for one.
  const fills = r.pages.flatMap((p) => p.steps.filter((s) => 'fill' in s).map((s) => s.with))
  assert.ok(fills.includes('email'), `${at}: fills the email`)
  assert.equal(fills.includes('password'), r.kind === 'account' && key !== 'notion', `${at}: a password only for accounts that ask for one`)
  assert.ok(Object.keys(r.done).length > 0, at)
  for (const [o, list] of Object.entries(r.done)) {
    assert.ok(OUTCOMES.has(o), `${at}: ${o}`)
    for (const d of list) {
      assert.ok(d.url || d.selector || d.text, `${at}: ${o} detector`)
      if (d.url) regex(d.url, at)
      if (d.text) regex(d.text, at)
    }
  }
  // Every sign-up page says "Already have an account?": that must never read as "exists".
  for (const d of r.done.exists || []) if (d.text) assert.doesNotMatch('Already have an account? Log in', new RegExp(d.text, 'i'), `${at}: exists isn't the log-in link`)
}
// The services where a robot was refused, or a robot check met, are the extension's and the apps' only.
assert.equal(RECIPES.todoist.robot, false)
assert.equal(RECIPES.notion.robot, false)
assert.equal(RECIPES.autismcanada.robot, false)
assert.equal(RECIPES.focusmate.robot, true)
// Headspace's marketing box is on its page, and isn't ticked.
assert.ok(!JSON.stringify(RECIPES.headspace.pages).includes('email-optin'))
// CHADD's form has a hidden trap field for robots: never filled.
assert.ok(!JSON.stringify(RECIPES.chadd.pages).includes('b_aa36'))

// ── Matching a web address to its service ──
assert.equal(recipeForUrl('https://www.focusmate.com')?.key, 'focusmate')
assert.equal(recipeForUrl('focusmate.com/pricing')?.key, 'focusmate')
assert.equal(recipeForUrl('https://app.todoist.com/app/today')?.key, 'todoist')
assert.equal(recipeForUrl('https://notion.so')?.key, 'notion')
assert.equal(recipeForUrl('https://www.notion.com/product')?.key, 'notion')
assert.equal(recipeForUrl('https://chadd.org/about')?.key, 'chadd')
assert.equal(recipeForUrl('https://notfocusmate.com'), null, 'a different site that ends the same is not it')
assert.equal(recipeForUrl('https://focusmate.com.evil.example'), null)
assert.equal(recipeForUrl('https://calm.com'), null)
assert.equal(recipeForUrl('#'), null)
assert.equal(recipeForUrl(''), null)
assert.equal(recipeForUrl(null), null)

// ── The runner can be sent into any page: one self-contained function ──
const src = runSignup.toString()
assert.doesNotThrow(() => new Function(`return (${src})`)(), 'the runner parses on its own')
assert.ok(!/\brequire\(|\bimport\(/.test(src), 'no imports inside the runner')

console.log('signupKit: all passed')
