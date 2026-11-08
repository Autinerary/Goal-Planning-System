// Run from frontend/: node --experimental-strip-types lib/emailStop.test.mjs
//
// Every email to a person says who sent it, with our mailing address, and how to stop it (Canada's anti-spam law), and
// the stop links work without signing in: signed, one kind each, never for someone else's account, and the check-in's
// for a year, not only the 30 days its question is open.
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

// '@/lib/x' as in the app (tsconfig paths), and files without their extension.
const root = pathToFileURL(new URL('..', import.meta.url).pathname).href
register('data:text/javascript,' + encodeURIComponent(
  `const root = ${JSON.stringify(root)};` +
  'export async function resolve(s, c, next) { if (s.startsWith("@/")) s = root + s.slice(2); ' +
  'try { return await next(s, c) } catch (e) { if (!/\\.[a-z]+$/.test(s)) return next(s + ".ts", c); throw e } }'))

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-secret'
const email = await import('./email.ts')
const stop = await import('./emailStopLinks.ts')
const token = await import('./checkinToken.ts')
const { CONTACT_EMAIL } = await import('./contact.ts')

const APP = 'https://app.autinerary.ca'
const ME = '11111111-2222-3333-4444-555555555555'
const YOU = '99999999-8888-7777-6666-555555555555'
const POSTAL = '123 Example St, Toronto, ON M5V 1A1'

// Signed stop links: one kind each, never another account.
const links = stop.stopLinks(APP, 'reminders', ME)
const q = new URL(links.oneClick).searchParams
assert.equal(q.get('k'), 'reminders')
assert.equal(q.get('u'), ME)
assert.ok(links.stop.startsWith(`${APP}/emails/stop?`))
assert.ok(links.oneClick.startsWith(`${APP}/api/emails/stop?`))
assert.equal(stop.stopSignatureMatches('reminders', ME, q.get('t')), true)
assert.equal(stop.stopSignatureMatches('reminders', YOU, q.get('t')), false, "not for someone else's account")
assert.equal(stop.stopSignatureMatches('vendor', ME, q.get('t')), false, 'a reminders link cannot stop another kind')
assert.equal(stop.stopSignatureMatches('everything', ME, q.get('t')), false)
assert.equal(stop.stopSignatureMatches('reminders', 'not-an-id', q.get('t')), false)
assert.equal(stop.stopSignatureMatches('reminders', ME, ''), false)
assert.deepEqual(stop.oneClickHeaders(links.oneClick), { 'List-Unsubscribe': `<${links.oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })

// Stopping keeps everything else in their preferences.
const fakeAdmin = (preferences) => {
  const saved = {}
  const api = {
    from: () => api,
    select: () => api,
    eq: () => api,
    maybeSingle: async () => ({ data: { preferences }, error: null }),
    update: (row) => { saved.row = row; return { eq: async () => ({ error: null }) } },
  }
  return { api, saved }
}
const before = { name: 'Sam', reminders: { enabled: true, consent: 'yes', time: '09:00', timeZone: 'America/Toronto' }, checkin: { optIn: true } }
let f = fakeAdmin(before)
await stop.stopEmails(f.api, 'reminders', ME)
assert.equal(f.saved.row.preferences.reminders.enabled, false)
assert.equal(f.saved.row.preferences.reminders.time, '09:00', 'the chosen time is kept, for turning them on again')
assert.equal(f.saved.row.preferences.name, 'Sam')
assert.deepEqual(f.saved.row.preferences.checkin, { optIn: true }, 'other emails are unchanged')
f = fakeAdmin({ name: 'Vendor' })
await stop.stopEmails(f.api, 'vendor', ME)
assert.equal(stop.vendorEmailsOn(f.saved.row.preferences), false)
assert.equal(f.saved.row.preferences.name, 'Vendor')
assert.equal(stop.vendorEmailsOn({}), true)
assert.equal(stop.vendorEmailsOn(null), true)

// The check-in's stop works for a year; its question for 30 days.
const issued = new Date('2026-01-01T12:00:00Z')
const t = token.createCheckinToken(ME, issued)
const day = (n) => new Date(issued.getTime() + n * 86_400_000)
assert.equal(token.verifyCheckinToken(t, day(30)), ME)
assert.equal(token.verifyCheckinToken(t, day(90)), null, 'the question has closed')
f = fakeAdmin({ checkin: { optIn: true }, name: 'Sam' })
assert.equal(await token.stopCheckinEmails(f.api, t, day(90)), true, 'but stopping still works after 60 days')
assert.equal(f.saved.row.preferences.checkin.optIn, false)
assert.equal(f.saved.row.preferences.name, 'Sam')
assert.equal(await token.stopCheckinEmails(fakeAdmin({}).api, t, day(400)), false)
assert.equal(await token.stopCheckinEmails(fakeAdmin({}).api, `${t}x`, day(1)), false, 'a changed token is refused')

// Each email: who we are, our address, and how to stop.
const has = (mail, ...parts) => {
  for (const part of parts) {
    assert.ok(mail.text.includes(part), `${mail.subject}: text has ${part}`)
    assert.ok(mail.html.includes(part) || mail.html.includes(part.replace(/&/g, '&amp;')), `${mail.subject}: html has ${part}`)
  }
}
const daily = email.dailyReminderEmail('Sam', APP, links.stop, POSTAL)
has(daily, 'Autinerary Corp.', POSTAL, links.stop, 'turned on daily reminders')
assert.ok(!daily.html.includes('What families and autistic adults told us'), 'no survey tiles in an email that can come every day')

const checkinToken = token.createCheckinToken(ME)
const checkin = email.checkinEmail(APP, checkinToken, POSTAL)
has(checkin, 'Autinerary Corp.', POSTAL, `/checkin?t=${encodeURIComponent(checkinToken)}&stop=1`)
const headers = email.checkinStopHeaders(APP, checkinToken)
assert.equal(headers['List-Unsubscribe'], `<${APP}/api/checkin/stop?t=${encodeURIComponent(checkinToken)}>`)
assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')

for (const mail of [email.welcomeEmail(APP, POSTAL), email.storyReadyEmail(APP, POSTAL)]) {
  has(mail, 'Autinerary Corp.', POSTAL, CONTACT_EMAIL, `${APP}/profile/settings#emails`)
}
// Without the address set, still who we are, never "undefined".
const bare = email.welcomeEmail(APP)
assert.ok(bare.text.includes('Autinerary Corp.') && !/undefined|null/.test(bare.text))

const vendorLinks = stop.stopLinks(APP, 'vendor', ME)
const vendor = email.vendorDiscountEventEmail({ name: 'Back to school', starts: '2026-08-20', ends: '2026-09-05', percent: 15, link: `${APP}/business`, postal: POSTAL, stop: vendorLinks.stop })
has(vendor, 'Autinerary Corp.', POSTAL, vendorLinks.stop)

console.log('emailStop: ok')
