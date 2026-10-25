// Run from frontend/: node --experimental-strip-types lib/signupPartners.test.mjs
import assert from 'node:assert/strict'
import { outcomeOf, partnerSignup, partnersFrom, requestBody, signature, verifySignature } from './signupPartners.ts'

// ── The partners setting: anything malformed is left out ──
const good = { name: 'Focusmate', hosts: ['focusmate.com'], url: 'https://api.focusmate.example/autinerary', secretEnv: 'PARTNER_FOCUSMATE_SECRET' }
assert.deepEqual(Object.keys(partnersFrom(JSON.stringify({ focusmate: good }))), ['focusmate'])
assert.deepEqual(partnersFrom(''), {})
assert.deepEqual(partnersFrom('not json'), {})
assert.deepEqual(partnersFrom(null), {})
assert.deepEqual(partnersFrom(JSON.stringify({ 'Bad Key': good })), {}, 'keys as service_signups takes them')
assert.deepEqual(partnersFrom(JSON.stringify({ x2: { ...good, url: 'http://insecure.example' } })), {}, 'https only')
assert.deepEqual(partnersFrom(JSON.stringify({ x2: { ...good, hosts: ['not a host'] } })), {})
assert.deepEqual(partnersFrom(JSON.stringify({ x2: { ...good, secretEnv: 'lower-case' } })), {}, 'the secret is an environment variable name, never the secret itself')
assert.deepEqual(partnersFrom(JSON.stringify({ x2: { ...good, name: undefined } })), {})

// ── Signing: what we send, what the partner checks ──
const secret = 'test-secret-123'
const body = requestBody({ requestId: 'r1', service: 'focusmate', person: { firstName: 'Sam', lastName: 'Lee', email: 'sam@example.com' }, consentedAt: '2026-10-25T10:00:00Z', sentAt: '2026-10-25T10:01:00Z' })
assert.deepEqual(JSON.parse(body), { version: 1, requestId: 'r1', service: 'focusmate', person: { firstName: 'Sam', lastName: 'Lee', email: 'sam@example.com' }, consentedAt: '2026-10-25T10:00:00Z', sentAt: '2026-10-25T10:01:00Z' })
const t = 1792900000
const sig = signature(secret, body, t)
assert.match(sig, /^t=1792900000,v1=[0-9a-f]{64}$/)
assert.equal(verifySignature(secret, body, sig, t + 10), true)
assert.equal(verifySignature('other-secret', body, sig, t + 10), false, 'the wrong secret')
assert.equal(verifySignature(secret, body.replace('Sam', 'Sal'), sig, t + 10), false, 'a changed body')
assert.equal(verifySignature(secret, body, sig, t + 301), false, 'too old: no replays')
assert.equal(verifySignature(secret, body, 'garbage', t), false)
assert.equal(verifySignature(secret, body, null, t), false)

// ── Their answers ──
assert.equal(outcomeOf('created'), 'signed_up')
assert.equal(outcomeOf('exists'), 'exists')
assert.equal(outcomeOf('verify_email'), 'check_email')
assert.equal(outcomeOf('weird'), 'failed')
assert.equal(outcomeOf(undefined), 'failed')

// ── Sending, against a stand-in partner ──
const partner = { key: 'focusmate', ...good }
const person = { firstName: 'Sam', lastName: 'Lee', email: 'sam@example.com' }
let seen = null
const stand = (reply, status = 200) => async (url, init) => {
  seen = { url, init }
  assert.equal(verifySignature(secret, init.body, init.headers['X-Autinerary-Signature']), true, 'the partner can check it')
  return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } })
}
let r = await partnerSignup(partner, secret, { requestId: 'req-1', person, consentedAt: '2026-10-25T10:00:00Z' }, stand({ status: 'created', loginUrl: 'https://focusmate.example/welcome' }))
assert.deepEqual(r, { status: 'signed_up', loginUrl: 'https://focusmate.example/welcome' })
assert.equal(seen.url, good.url)
assert.equal(seen.init.headers['X-Autinerary-Request-Id'], 'req-1')
assert.equal(JSON.parse(seen.init.body).person.email, 'sam@example.com')
assert.ok(!('password' in JSON.parse(seen.init.body).person), 'never a password: the partner makes the account')
r = await partnerSignup(partner, secret, { requestId: 'req-2', person, consentedAt: 'x' }, stand({ status: 'exists', loginUrl: 'javascript:alert(1)' }))
assert.deepEqual(r, { status: 'exists' }, 'only an https login link is passed on')
r = await partnerSignup(partner, secret, { requestId: 'req-3', person, consentedAt: 'x' }, stand({ status: 'verify_email' }))
assert.equal(r.status, 'check_email')
r = await partnerSignup(partner, secret, { requestId: 'req-4', person, consentedAt: 'x' }, stand({ message: 'Down for maintenance' }, 503))
assert.deepEqual(r, { status: 'failed', detail: 'Down for maintenance' })
r = await partnerSignup(partner, secret, { requestId: 'req-5', person, consentedAt: 'x' }, async () => { throw new Error('ECONNREFUSED') })
assert.deepEqual(r, { status: 'failed', detail: 'Focusmate didn’t answer.' })

console.log('signupPartners: all passed')
