// Run from frontend/: node --experimental-strip-types lib/applications.test.mjs
import assert from 'node:assert/strict'
import {
  APPLY_ON, DAILY_LIMIT, UNDO_SECONDS, applicationEmail, applyAllPlan, applyRefusal, canApplyAgain, cleanDetails,
  defaultDetails, detailsFromRow, detailsToRow, howToApply, isApplied, isEmail, isPlace, listingEmail, statusLabel,
  waitingTeamEmail,
} from './applications.ts'

// ── Off unless switched on; small limits ──
assert.equal(APPLY_ON, process.env.NEXT_PUBLIC_ONE_CLICK_APPLY === 'on')
assert.ok(UNDO_SECONDS >= 3 && UNDO_SECONDS <= 10)
assert.ok(DAILY_LIMIT >= 5 && DAILY_LIMIT <= 20)

// ── What can be applied to ──
assert.equal(isEmail('info@clinic.ca'), true)
assert.equal(isEmail(' info@clinic.ca '), true)
assert.equal(isEmail('info@clinic'), false)
assert.equal(isEmail('two@at@clinic.ca'), false)
assert.equal(isEmail('a b@clinic.ca'), false)
assert.equal(isEmail('x@y.ca, other@z.ca'), false, 'one address, never a list')
assert.equal(isEmail(''), false)
assert.equal(isEmail(null), false)
assert.equal(listingEmail({ email: 'hello@x.org', phone: '1' }), 'hello@x.org')
assert.equal(listingEmail({ email: 'not an email' }), null)
assert.equal(listingEmail(null), null)

assert.equal(isPlace('Café'), true)
assert.equal(isPlace(' park '), true)
assert.equal(isPlace('Therapist'), false)
assert.equal(isPlace(null), false)

const service = { category: 'Therapist', status: 'approved', contact_info: { email: 'a@clinic.ca' } }
assert.equal(howToApply(service), 'email')
assert.equal(howToApply({ ...service, contact_info: { phone: '416' } }), 'wait', 'no email: held for the team')
assert.equal(howToApply({ ...service, contact_info: null }), 'wait')
assert.equal(howToApply({ ...service, category: 'Restaurant' }), 'none', 'places have nothing to apply for')
assert.equal(howToApply({ ...service, category: 'Park', contact_info: null }), 'none')
assert.equal(howToApply({ ...service, status: 'pending' }), 'none', 'only approved listings')
assert.equal(howToApply({ ...service, status: 'rejected' }), 'none')
assert.equal(howToApply({ ...service, type: 'product' }), 'none', 'products are bought, not applied to')
assert.equal(howToApply({ ...service, type: 'commentary' }), 'none')
assert.equal(howToApply({ category: 'Therapist', contact_info: { email: 'a@clinic.ca' } }), 'email', 'a plan tool has no status: fine')

assert.equal(isApplied('sent'), true)
assert.equal(isApplied('waiting'), true)
assert.equal(isApplied('unreachable'), true, 'the team found no address: not asked again')
assert.equal(isApplied('cancelled'), false)
assert.equal(isApplied('failed'), false)
assert.equal(isApplied(null), false)
assert.equal(canApplyAgain('failed'), true)
assert.equal(canApplyAgain('cancelled'), true)
assert.equal(canApplyAgain('sent'), false)

// ── Apply all: send, hold, already done, nothing to apply for; each once ──
const plan = applyAllPlan([
  { resourceId: 'a', name: 'A', how: 'email' },
  { resourceId: 'b', name: 'B', how: 'wait' },
  { resourceId: 'c', name: 'C', how: 'email', status: 'sent' },
  { resourceId: 'd', name: 'D', how: 'none' },
  { resourceId: 'e', name: 'E', how: 'email', status: 'failed' },
  { resourceId: 'f', name: 'F', how: 'wait', status: 'waiting' },
  { resourceId: 'g', name: 'G', how: 'email', status: 'cancelled' },
  { resourceId: 'a', name: 'A again', how: 'email' },
  { resourceId: '', name: 'No id', how: 'email' },
])
assert.deepEqual(plan.send.map((i) => i.resourceId), ['a', 'e', 'g'])
assert.deepEqual(plan.hold.map((i) => i.resourceId), ['b'])
assert.deepEqual(plan.done.map((i) => i.resourceId), ['c', 'f'])
assert.deepEqual(plan.none.map((i) => i.resourceId), ['d'])
assert.deepEqual(applyAllPlan([]), { send: [], hold: [], done: [], none: [] })

// ── Who may apply ──
assert.equal(applyRefusal({ adult: true, managed: false, hasEmail: true }), null)
assert.match(applyRefusal({ adult: false, managed: false, hasEmail: true }), /parent’s or guardian’s/)
assert.match(applyRefusal({ adult: true, managed: true, hasEmail: true }), /parent’s or guardian’s/, 'a Family account (managed) never sends')
assert.match(applyRefusal({ adult: true, managed: false, hasEmail: false }), /email address/)

// ── The details, checked ──
const ok = (raw) => {
  const r = cleanDetails(raw)
  assert.equal(r.ok, true, r.error)
  return r.details
}
const bad = (raw, re) => {
  const r = cleanDetails(raw)
  assert.equal(r.ok, false)
  assert.match(r.error, re)
}
bad({}, /Add your name/)
bad({ fullName: '   ' }, /Add your name/)
assert.deepEqual(ok({ fullName: '  Sam   Lee ' }), {
  fullName: 'Sam Lee', phone: null, applyingFor: 'me', theirName: null, theirAge: null, needs: null, contactBy: 'email',
})
assert.equal(ok({ fullName: 'Sam\r\nBcc: x@evil.test' }).fullName, 'Sam Bcc: x@evil.test', 'no line breaks in a name (it goes in the subject)')
assert.equal(ok({ fullName: 'x'.repeat(500) }).fullName.length, 120)
assert.equal(ok({ fullName: 'Sam', phone: '(416) 555-0100 x12' }).phone, '(416) 555-0100 x12')
bad({ fullName: 'Sam', phone: '12' }, /phone number/)
bad({ fullName: 'Sam', phone: 'call me maybe 4165550100' }, /phone number/)
bad({ fullName: 'Sam', contactBy: 'phone' }, /Add a phone number/)
bad({ fullName: 'Sam', contactBy: 'text' }, /Add a phone number/)
assert.equal(ok({ fullName: 'Sam', contactBy: 'any' }).contactBy, 'any', 'any: email works without a phone')
assert.equal(ok({ fullName: 'Sam', contactBy: 'fax' }).contactBy, 'email')
assert.equal(ok({ fullName: 'Sam', applyingFor: 'everyone' }).applyingFor, 'me')
const child = ok({ fullName: 'Sam', applyingFor: 'child', theirName: ' Jo ', theirAge: '9' })
assert.equal(child.theirName, 'Jo')
assert.equal(child.theirAge, 9)
assert.equal(ok({ fullName: 'Sam', applyingFor: 'me', theirName: 'Jo', theirAge: 9 }).theirName, null, 'for me: no one else named')
assert.equal(ok({ fullName: 'Sam', applyingFor: 'child', theirAge: '' }).theirAge, null)
bad({ fullName: 'Sam', applyingFor: 'child', theirAge: 300 }, /age/)
assert.equal(ok({ fullName: 'Sam', needs: 'Line one\r\n\r\n\r\n\r\nLine two\u0007' }).needs, 'Line one\n\nLine two')
assert.equal(ok({ fullName: 'Sam', needs: 'y'.repeat(900) }).needs.length, 600)

// Rows round-trip; a broken row reads as none (the person is asked again).
const d = ok({ fullName: 'Sam Lee', phone: '416 555 0100', applyingFor: 'child', theirName: 'Jo', theirAge: 9, needs: 'Speech therapy', contactBy: 'text' })
const row = detailsToRow('u1', d)
assert.equal(row.user_id, 'u1')
assert.equal(row.applying_for, 'child')
assert.deepEqual(detailsFromRow(row), d)
assert.equal(detailsFromRow({ full_name: '' }), null)
assert.equal(detailsFromRow(null), null)

// A first guess from the profile: never a phone, and who it's for from setup's answer.
assert.equal(defaultDetails({ fullName: 'Sam Lee', audience: 'child' }).applyingFor, 'child')
assert.equal(defaultDetails({ displayName: 'Sam', audience: 'work' }).applyingFor, 'someone')
assert.equal(defaultDetails({ audience: 'family' }).applyingFor, 'someone')
assert.equal(defaultDetails({ audience: 'self' }).applyingFor, 'me')
assert.equal(defaultDetails({ audience: 'unsure' }).applyingFor, 'me')
assert.equal(defaultDetails({ displayName: 'Sam' }).fullName, 'Sam')
assert.equal(defaultDetails({}).phone, null)

// ── The email the service gets ──
const claimUrl = 'https://app.autinerary.ca/business?claim=resource:r1'
const mine = applicationEmail({ details: ok({ fullName: 'Sam Lee', needs: 'Help with anxiety at work' }), replyTo: 'sam@example.com', serviceName: 'Clinic A', claimUrl })
assert.equal(mine.subject, 'New request from Sam Lee, via Autinerary')
assert.match(mine.text, /^Hello Clinic A,/)
assert.match(mine.text, /Sam Lee would like to start with your service, and asked Autinerary to send you this request\./)
assert.match(mine.text, /What they’re looking for:\nHelp with anxiety at work/)
assert.match(mine.text, /Email: sam@example\.com/)
assert.doesNotMatch(mine.text, /Phone:/, 'no phone unless they gave one')
assert.match(mine.text, /prefer to be contacted by email \(reply to this message\)/)
assert.match(mine.text, /next steps/)
assert.match(mine.text, /Autinerary doesn’t see it/)
assert.ok(mine.text.includes(claimUrl))
assert.ok(mine.html.includes(`href="${claimUrl}"`))

const forChild = applicationEmail({ details: child, replyTo: 'sam@example.com', serviceName: 'Clinic A', claimUrl })
assert.match(forChild.text, /would like to start with your service for their child, Jo \(age 9\)/)
const forSomeone = applicationEmail({ details: ok({ fullName: 'Sam', applyingFor: 'someone' }), replyTo: 's@x.ca', serviceName: 'B', claimUrl })
assert.match(forSomeone.text, /for someone they support, and asked/)
const withPhone = applicationEmail({ details: ok({ fullName: 'Sam', phone: '416 555 0100', contactBy: 'text' }), replyTo: 's@x.ca', serviceName: 'B', claimUrl })
assert.match(withPhone.text, /Phone: 416 555 0100\nThey prefer to be contacted by text message\./)
assert.doesNotMatch(mine.text, /needs|barrier|diagnos|autis|ADHD/i, 'nothing about their norms unless they wrote it')

// Everything they typed is escaped in the HTML.
const sneaky = applicationEmail({ details: ok({ fullName: '<b>Sam</b>', needs: '<script>x()</script>\nline 2' }), replyTo: 's@x.ca', serviceName: 'A & B "Clinic"', claimUrl })
assert.ok(!sneaky.html.includes('<script>'))
assert.ok(!sneaky.html.includes('<b>Sam</b>'))
assert.ok(sneaky.html.includes('&lt;script&gt;x()&lt;/script&gt;<br>line 2'))
assert.ok(sneaky.html.includes('Hello A &amp; B &quot;Clinic&quot;,'))
assert.match(applicationEmail({ details: d, replyTo: 's@x.ca', serviceName: '', claimUrl }).text, /^Hello there,/)

// The team's note has no personal details.
const team = waitingTeamEmail({ serviceName: 'Clinic B', adminUrl: 'https://app.autinerary.ca/admin/applications', waiting: 2 })
assert.equal(team.subject, 'Apply: Clinic B needs an email address')
assert.match(team.text, /Waiting for this service: 2\./)
assert.match(team.text, /\/admin\/applications/)

// ── Saying where an application is ──
assert.equal(statusLabel('sent', '2026-10-26T15:00:00Z'), 'Applied Oct 26')
assert.equal(statusLabel('sent', null), 'Applied')
assert.match(statusLabel('waiting'), /finding their email address/)
assert.match(statusLabel('unreachable'), /couldn’t reach them/)
assert.match(statusLabel('failed'), /Try again/)
assert.equal(statusLabel('cancelled'), '')
assert.equal(statusLabel(null), '')

console.log('applications: all passed')
