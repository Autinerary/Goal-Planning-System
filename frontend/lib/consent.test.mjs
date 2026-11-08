// Run from frontend/: node --experimental-strip-types lib/consent.test.mjs
//
// Nothing is counted before someone presses Allow, in the app and in ResourceHub (lib/consent.ts, and its copy in
// servicehub-mvp/lib/consent.ts): a browser sending Global Privacy Control or Do Not Track is a no whatever was
// pressed, and a no removes what counting kept in the browser, and nothing else.
import assert from 'node:assert/strict'
import * as app from './consent.ts'
import * as hub from '../../servicehub-mvp/lib/consent.ts'

const memory = (start = {}) => {
  const m = new Map(Object.entries(start))
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()].sort() }
}
const plain = { globalPrivacyControl: false, doNotTrack: null }

for (const [name, c] of [['app', app], ['ResourceHub', hub]]) {
  // Before any answer: not counted.
  assert.equal(c.countingConsent(memory()), null, name)
  assert.equal(c.countingAllowed(memory(), plain), false, `${name}: nothing counted before an answer`)

  // A yes counts; a no doesn't.
  const s = memory()
  c.setCountingConsent('yes', s)
  assert.equal(c.countingConsent(s), 'yes', name)
  assert.equal(c.countingAllowed(s, plain), true, `${name}: counted after Allow`)

  // The browser saying no wins over a yes.
  assert.equal(c.countingAllowed(s, { globalPrivacyControl: true }), false, `${name}: Global Privacy Control is a no`)
  assert.equal(c.countingAllowed(s, { doNotTrack: '1' }), false, `${name}: Do Not Track is a no`)
  assert.equal(c.browserSaysNo(null), true, `${name}: with no browser (the server), nothing is counted`)
  assert.equal(c.browserSaysNo(plain), false, name)

  // A no removes what counting kept, and only that.
  const kept = Object.fromEntries(c.COUNTING_KEYS.map((k) => [k, 'x']))
  const t = memory({ ...kept, 'sb-abc-auth-token': 'session', [c.CONSENT_KEY]: 'yes', other_setting: 'calm' })
  c.setCountingConsent('no', t)
  assert.equal(c.countingAllowed(t, plain), false, name)
  for (const k of c.COUNTING_KEYS) assert.equal(t.getItem(k), null, `${name}: ${k} removed on no`)
  assert.equal(t.getItem('sb-abc-auth-token'), 'session', `${name}: signing in stays`)
  assert.equal(t.getItem('other_setting'), 'calm', `${name}: settings stay`)

  // Anything other than yes or no is no answer.
  assert.equal(c.countingConsent(memory({ [c.CONSENT_KEY]: 'maybe' })), null, name)
  // A store that throws (private mode) is no answer, not an error.
  const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => {} }
  assert.equal(c.countingAllowed(broken, plain), false, name)
  assert.doesNotThrow(() => c.setCountingConsent('yes', broken), name)
}

// The app reads the Google Analytics answer kept before November 2026, once, and forgets the old key on a new answer.
const old = memory({ autinerary_ga_consent: 'yes' })
assert.equal(app.countingConsent(old), 'yes')
app.setCountingConsent('no', old)
assert.equal(old.getItem('autinerary_ga_consent'), null)
assert.equal(app.countingConsent(old), 'no')

// The two apps keep separate answers and separate counting keys (different sites).
assert.notEqual(app.CONSENT_KEY, hub.CONSENT_KEY)
assert.ok(app.COUNTING_KEYS.includes('autinerary_visitor_id') && app.COUNTING_KEYS.includes('autinerary_movement'))
assert.ok(hub.COUNTING_KEYS.includes('rh_visitor_id'))

console.log('consent: ok')
