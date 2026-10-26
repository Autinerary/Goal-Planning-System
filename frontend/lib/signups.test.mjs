// Run from frontend/: node --experimental-strip-types lib/signups.test.mjs
import assert from 'node:assert/strict'
import {
  ROBOT_DAILY_LIMIT, SIGNUP_ON, cleanDetails, isRunner, isSettled, isStatus, outcomeMessage, pickRunner, shortDate,
  signupPlan, signupRefusal, splitName, statusLabel,
} from './signups.ts'

assert.equal(SIGNUP_ON, process.env.NEXT_PUBLIC_ONE_CLICK_SIGNUP === 'on')
assert.ok(ROBOT_DAILY_LIMIT >= 3 && ROBOT_DAILY_LIMIT <= 20)

// The values service_signups accepts (STEP 90).
for (const s of ['started', 'signed_up', 'check_email', 'needs_you', 'exists', 'failed']) assert.ok(isStatus(s))
assert.equal(isStatus('maybe'), false)
for (const r of ['extension', 'desktop', 'mobile', 'server', 'partner']) assert.ok(isRunner(r))
assert.equal(isRunner('robot'), false)
assert.ok(isSettled('signed_up') && isSettled('check_email') && isSettled('exists'))
assert.ok(!isSettled('failed') && !isSettled('needs_you') && !isSettled('started') && !isSettled(null))

// ── Names ──
assert.deepEqual(splitName('Sam Lee'), { firstName: 'Sam', lastName: 'Lee' })
assert.deepEqual(splitName('  Mary  Ann   Lee '), { firstName: 'Mary Ann', lastName: 'Lee' })
assert.deepEqual(splitName('Sam'), { firstName: 'Sam', lastName: '' })
assert.deepEqual(splitName(''), { firstName: '', lastName: '' })
assert.deepEqual(splitName(null), { firstName: '', lastName: '' })
assert.deepEqual(cleanDetails({ firstName: ' Sam ', lastName: 'Lee\n' }), { ok: true, details: { firstName: 'Sam', lastName: 'Lee' } })
assert.match(cleanDetails({ lastName: 'Lee' }).error, /first name/)
assert.match(cleanDetails({ firstName: 'Sam' }).error, /last name/)
assert.equal(cleanDetails({ firstName: 'x'.repeat(200), lastName: 'y' }).details.firstName.length, 60)
assert.equal(cleanDetails({ firstName: 'Sam\u0000\u0007Lee', lastName: 'Q' }).details.firstName, 'Sam Lee', 'no control characters')

// ── Who may ──
assert.equal(signupRefusal({ adult: true, managed: false, hasEmail: true }), null)
assert.match(signupRefusal({ adult: false, managed: false, hasEmail: true }), /parent’s or guardian’s/)
assert.match(signupRefusal({ adult: true, managed: true, hasEmail: true }), /parent’s or guardian’s/)
assert.match(signupRefusal({ adult: true, managed: false, hasEmail: false }), /email address/)

// ── What runs it ──
assert.equal(pickRunner({ extension: true, robot: true }), 'extension', 'their own browser first')
assert.equal(pickRunner({ extension: true, robot: false }), 'extension')
assert.equal(pickRunner({ extension: false, robot: true }), 'server')
assert.equal(pickRunner({ extension: false, robot: false }), null)
assert.equal(pickRunner({ partner: true, desktop: true, extension: true, robot: true }), 'partner', 'a partner needs no form at all')
assert.equal(pickRunner({ desktop: true, extension: true, robot: true }), 'desktop', 'in the desktop app, its own window')
assert.equal(pickRunner({ desktop: false, extension: false, robot: false, partner: false }), null)

// ── Words ──
assert.equal(shortDate('2026-10-26T15:00:00Z'), 'Oct 26')
assert.equal(shortDate('nope'), '')
assert.equal(statusLabel('signed_up', 'account', '2026-10-26T15:00:00Z'), 'Signed up Oct 26')
assert.equal(statusLabel('signed_up', 'newsletter', null), 'Subscribed')
assert.match(statusLabel('check_email', 'account'), /email/)
assert.match(statusLabel('exists', 'account'), /already have an account/)
assert.match(statusLabel('needs_you', 'account'), /finish/)
assert.match(statusLabel('failed', 'account'), /Try again/)
assert.equal(statusLabel(null, 'account'), '')
assert.match(outcomeMessage('Focusmate', 'account', 'signed_up'), /^Signed up for Focusmate\. Save your new password/)
assert.equal(outcomeMessage('CHADD’s newsletter', 'newsletter', 'signed_up'), 'Subscribed to CHADD’s newsletter.')
assert.match(outcomeMessage('Focusmate', 'account', 'check_email'), /sent you an email: open it to finish\. Save your new password/)
assert.doesNotMatch(outcomeMessage('CHADD', 'newsletter', 'check_email'), /password/, 'no password for a newsletter')
assert.match(outcomeMessage('Todoist', 'account', 'needs_you', 'robot_check'), /not a robot: finish it in the Todoist tab/)
assert.match(outcomeMessage('Todoist', 'account', 'needs_you'), /only you can do/)
assert.match(outcomeMessage('Notion', 'account', 'exists'), /already have an account with Notion/)
assert.match(outcomeMessage('Speechify', 'account', 'failed', 'Email taken'), /didn’t take it \(“Email taken”\)\. If you already have an account there, log in instead\./)
assert.match(outcomeMessage('Speechify', 'account', 'timeout'), /took too long/)

// ── Sign up for all: go, done, can't from here; each once ──
const plan = signupPlan([
  { service: 'focusmate', name: 'Focusmate', runner: 'extension' },
  { service: 'todoist', name: 'Todoist', runner: null },
  { service: 'headspace', name: 'Headspace', runner: 'server', status: 'signed_up' },
  { service: 'chadd', name: 'CHADD', runner: 'server', status: 'failed' },
  { service: 'notion', name: 'Notion', runner: 'extension', status: 'exists' },
  { service: 'focusmate', name: 'Focusmate again', runner: 'extension' },
  { service: '', name: 'none', runner: 'extension' },
])
assert.deepEqual(plan.go.map((i) => i.service), ['focusmate', 'chadd'], 'a failed one can be tried again')
assert.deepEqual(plan.done.map((i) => i.service), ['headspace', 'notion'])
assert.deepEqual(plan.cant.map((i) => i.service), ['todoist'])

// A local service's request (lib/requests.ts)
assert.match(outcomeMessage('Calm Clinic', 'request', 'requested'), /^Your request went to Calm Clinic\. They’ll reply to you by email/)
assert.equal(outcomeMessage('Calm Clinic', 'request', 'requested', 'website_email:info@calmclinic.ca'), 'Your request went to Calm Clinic, by email to the address on their website (info@calmclinic.ca). They’ll reply to you by email, and you have a copy.')
assert.equal(outcomeMessage('Calm Clinic', 'request', 'failed', 'No contact form or email address on their website.'), 'Your request couldn’t go to Calm Clinic (No contact form or email address on their website).')
assert.doesNotMatch(outcomeMessage('Calm Clinic', 'request', 'failed'), /log in/, 'no account to log in to')
assert.match(outcomeMessage('Calm Clinic', 'request', 'needs_you', 'robot_check'), /not a robot/)

console.log('signups: all passed')
