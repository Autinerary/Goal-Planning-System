// Run from frontend/: node --experimental-strip-types lib/requests.test.mjs
import assert from 'node:assert/strict'
import {
  NO_EXTRAS, REQUEST_DAILY_LIMIT, cleanExtras, formMessage, formSubject, howToRequest, isEmail, isPlace, listingKey,
  listingWebsite, pickSiteEmail, requestEmail, resourceIdOfKey,
} from './requests.ts'

assert.ok(REQUEST_DAILY_LIMIT >= 5 && REQUEST_DAILY_LIMIT <= 20)

// ── Which listings, and how ──
const clinic = { category: 'Therapist', status: 'approved', contact_info: { email: 'hello@clinic.ca', website: 'https://clinic.ca' } }
assert.equal(howToRequest(clinic), 'email', 'an email address first')
assert.equal(howToRequest({ ...clinic, contact_info: { website: 'https://clinic.ca/contact' } }), 'form', 'only a website: its form')
assert.equal(howToRequest({ ...clinic, contact_info: { email: 'not an email', website: 'clinic.ca' } }), 'form')
assert.equal(howToRequest({ ...clinic, contact_info: { email: null, phone: null, website: null }, source_type: 'openstreetmap', source_url: 'https://www.openstreetmap.org/node/2363212328' }), 'none', 'the Career and Counselling Centre: no way online')
assert.equal(howToRequest({ ...clinic, contact_info: null, source_url: 'https://clinic.ca/about' }), 'form', 'a curated listing’s own page counts as its website')
assert.equal(howToRequest({ ...clinic, category: 'Park' }), 'none', 'places: nothing to sign up for')
assert.equal(howToRequest({ ...clinic, category: 'Café' }), 'none')
assert.equal(howToRequest({ ...clinic, status: 'pending' }), 'none', 'only approved listings')
assert.equal(isPlace(' Restaurant '), true)
assert.equal(isPlace('Doctor'), false)
assert.equal(isEmail('a@b.co'), true)
assert.equal(isEmail('a@b'), false)
assert.equal(isEmail('x@y.ca, z@w.ca'), false)
assert.equal(listingWebsite({ contact_info: { website: 'clinic.ca/contact' } }), 'https://clinic.ca/contact')
assert.equal(listingWebsite({ contact_info: { website: 'javascript:alert(1)' } }), null, 'never a script address')
assert.equal(listingWebsite({ contact_info: {}, source_type: 'openstreetmap', source_url: 'https://www.openstreetmap.org/node/1' }), null)

const id = '4fc0f9a3-b17a-4b8a-bd4c-c1b4c905b369'
assert.equal(listingKey(id), 'r-4fc0f9a3b17a4b8abd4cc1b4c905b369')
assert.match(listingKey(id), /^[a-z0-9-]{2,40}$/, 'the shape service_signups takes')
assert.equal(resourceIdOfKey(listingKey(id)), id)
assert.equal(resourceIdOfKey('focusmate'), null)

// ── No form on their website: the address it shows (real sites, 25 Oct 2026) ──
const at = (email, context = '', mailto = true) => ({ email, context, mailto })
assert.equal(pickSiteEmail([at('ccaputo@wsd1.org', 'Principal: C. Caputo'), at('riverview@wsd1.org', 'Riverview School 1305 Taylor Ave riverview@wsd1.org'), at('rtetrault@wsd1.org')], { name: 'Riverview School', website: 'https://www.winnipegsd.ca/Riverview' }),
  'riverview@wsd1.org', 'the school’s own name, over staff on another domain')
assert.equal(pickSiteEmail([at('info@kitchener.ca'), at('millcourtlandcc@kitchener.ca')], { name: 'Mill Courtland Community Centre', website: 'https://www.kitchener.ca/en/recreation-and-sports/mill-courtland.aspx' }),
  'millcourtlandcc@kitchener.ca', 'the centre’s address, over the whole city’s')
assert.equal(pickSiteEmail([at('jennifer.castaneto@dewc.ca'), at('admin@dewc.ca'), at('engagement@dewc.ca')], { name: 'Warming and respite space', website: 'https://dewc.ca/location/warming' }),
  'admin@dewc.ca', 'the front door, over a named person')
assert.equal(pickSiteEmail([at('mgermanese@caacentre.com'), at('info@caacentre.com')], { name: 'CAA Centre', website: 'http://caacentre.com/' }), 'info@caacentre.com')
assert.equal(pickSiteEmail([at('st.lucyelementaryinfo@dpcdsb.org'), at('supportoffice@dpcdsb.org')], { name: 'St. Lucy Elementary School', website: 'https://www.dpcdsb.org/LUCYE' }), 'st.lucyelementaryinfo@dpcdsb.org')
assert.equal(pickSiteEmail([at('stgeorges@tvdsb.ca')], { name: 'St. George’s Public School', website: 'https://www.tvdsb.ca/stgeorges' }), 'stgeorges@tvdsb.ca')
assert.equal(pickSiteEmail([at('compasscarestockyards@gmail.com')], { name: 'Compass Care Stockyards', website: 'https://compasscarestockyards.cortico.ca/' }), 'compasscarestockyards@gmail.com', 'a small practice’s free mail, by its name')
assert.equal(pickSiteEmail([at('mail@spinemuscle.ca', '', false)], { name: 'Spine and Muscle Clinic', website: 'https://www.spinemuscle.ca/' }), 'mail@spinemuscle.ca', 'written out, not linked')
assert.equal(pickSiteEmail([at('sharlene.macdonald@tcdsb.org', 'Principal'), at('flora.cifelli@tcdsb.org', 'Vice-Principal'), at('cspc.stmichael@tcdsb.org', 'Catholic School Parent Council chair')], { name: 'St. Michael Catholic School', website: 'http://stmichael.tcdsb.org/' }),
  null, 'only staff and the parent council: nobody to send it to')
assert.equal(pickSiteEmail([at('cspc.stmichael@tcdsb.org', 'cspc.stmichael@tcdsb.org')], { name: 'St. Michael Catholic School', website: 'http://stmichael.tcdsb.org/' }),
  null, 'the parent council by its address alone (as on the real page, 25 Oct 2026)')
assert.equal(pickSiteEmail([at('pta.riverview@wsd1.org'), at('riverview.sac@wsd1.org')], { name: 'Riverview School', website: 'https://www.winnipegsd.ca/Riverview' }), null)
assert.equal(pickSiteEmail([at('hello@pixelstudio.com', 'Website by Pixel Studio')], { name: 'Calm Clinic', website: 'https://calmclinic.ca' }), null, 'never the web designer')
assert.equal(pickSiteEmail([at('hello@partner.org', 'Our partners')], { name: 'Calm Clinic', website: 'https://calmclinic.ca' }), null, 'never someone else’s address')
assert.equal(pickSiteEmail([at('media@calmclinic.ca'), at('careers@calmclinic.ca'), at('noreply@calmclinic.ca'), at('privacy@calmclinic.ca')], { name: 'Calm Clinic', website: 'https://calmclinic.ca' }), null, 'never media, careers, no-reply or privacy')
assert.equal(pickSiteEmail([at('office@calmclinic.ca', 'For billing questions, email office@calmclinic.ca')], { name: 'Calm Clinic', website: 'https://calmclinic.ca' }), null, 'the words around it say billing')
assert.equal(pickSiteEmail([at('office@calmclinic.ca', 'For billing questions'), at('intake@calmclinic.ca', 'New clients: intake@calmclinic.ca')], { name: 'Calm Clinic', website: 'https://calmclinic.ca' }), 'intake@calmclinic.ca')
assert.equal(pickSiteEmail([at('you@example.com'), at('logo@2x.png'), at('3f2a9c1b77d04e5f8a@o12345.ingest.sentry.io'), at('team@autinerary.ca')], { name: 'Calm Clinic', website: 'https://calmclinic.ca' }), null, 'never a placeholder, a file name, a tracker or Autinerary')
assert.equal(pickSiteEmail([at('jane@janedoecounselling.ca')], { name: 'Jane Doe Counselling', website: 'https://janedoecounselling.ca' }), 'jane@janedoecounselling.ca', 'a one-person practice')
assert.equal(pickSiteEmail([at('info@Calmclinic.ca '), at('INFO@calmclinic.ca')], { name: 'Calm Clinic', website: 'https://www.calmclinic.ca' }), 'info@calmclinic.ca', 'spelled any way, the same address')
assert.equal(pickSiteEmail([at('info@city.toronto.on.ca')], { name: 'Riverdale Library', website: 'https://www.toronto.on.ca/riverdale' }), 'info@city.toronto.on.ca', 'toronto.on.ca is one site')
assert.equal(pickSiteEmail([at('info@other.on.ca')], { name: 'Riverdale Library', website: 'https://www.toronto.on.ca/riverdale' }), null, '…and other.on.ca another')
assert.equal(pickSiteEmail([], { name: 'Calm Clinic', website: 'https://calmclinic.ca' }), null)
assert.equal(pickSiteEmail(undefined, { name: null, website: null }), null)

// ── The extras ──
assert.deepEqual(cleanExtras({}), { ok: true, extras: NO_EXTRAS })
const child = cleanExtras({ applyingFor: 'child', theirName: ' Jo ', theirAge: '9', needs: 'Speech therapy\r\n\r\n\r\n\r\nafter school', phone: '416 555 0100', contactBy: 'text' })
assert.equal(child.ok, true)
assert.deepEqual(child.extras, { phone: '416 555 0100', applyingFor: 'child', theirName: 'Jo', theirAge: 9, needs: 'Speech therapy\n\nafter school', contactBy: 'text' })
assert.match(cleanExtras({ phone: '12' }).error, /phone number/)
assert.match(cleanExtras({ contactBy: 'phone' }).error, /Add a phone number/)
assert.match(cleanExtras({ applyingFor: 'child', theirAge: 300 }).error, /age/)
assert.equal(cleanExtras({ applyingFor: 'me', theirName: 'Jo' }).extras.theirName, null)
assert.equal(cleanExtras({ needs: 'y'.repeat(900) }).extras.needs.length, 500)

// ── What the service gets ──
const input = { firstName: 'Sam', lastName: 'Lee', email: 'sam@example.com', extras: child.extras, serviceName: 'Clinic A' }
const mail = requestEmail({ ...input, stopUrl: 'https://app.autinerary.ca/emails/requests-stop?e=a%40b.ca&t=sig' })
assert.equal(mail.subject, 'New request from Sam Lee, via Autinerary')
assert.match(mail.text, /^Hello Clinic A,/)
assert.match(mail.text, /Sam Lee would like to start with your service for their child, Jo \(age 9\)/)
assert.match(mail.text, /What they’re looking for:\nSpeech therapy/)
assert.match(mail.text, /Phone: 416 555 0100\nThey prefer to be contacted by text message\./)
assert.doesNotMatch(`${mail.text}${mail.html}`, /claim|Keep your listing|business/i, 'only the person’s request: no link to Autinerary’s listings')
assert.match(mail.text, /Stop them: https:\/\/app\.autinerary\.ca\/emails\/requests-stop\?e=a%40b\.ca&t=sig/, 'a way to stop requests to this address')
assert.ok(mail.html.includes('href="https://app.autinerary.ca/emails/requests-stop?e=a%40b.ca&amp;t=sig"'))
assert.doesNotMatch(mail.text, /address on your website/)
assert.doesNotMatch(mail.text, /Autinerary Corp\./, 'no mailing address unless it’s set')
const withPostal = requestEmail({ ...input, stopUrl: 'https://y.ca', postal: '100 King St W, Toronto ON' })
assert.match(withPostal.text, /\nAutinerary Corp\., 100 King St W, Toronto ON$/, 'who sent it, and where (as the other emails to services)')
assert.ok(withPostal.html.includes('Autinerary Corp., 100 King St W, Toronto ON'))
assert.match(requestEmail({ ...input, stopUrl: 'https://y.ca', fromWebsite: true }).text, /at Sam Lee’s request, to the address on your website\./, 'says where the address came from')
const sneaky = requestEmail({ ...input, firstName: '<b>Sam</b>', extras: { ...NO_EXTRAS, needs: '<script>x()</script>' }, stopUrl: 'https://y.ca' })
assert.ok(!sneaky.html.includes('<script>') && !sneaky.html.includes('<b>Sam</b>'), 'what they typed is escaped')
const msg = formMessage(input)
assert.match(msg, /^Hello, I'm Sam Lee\. I'd like to start with your service for my child, Jo \(9\)\./)
assert.match(msg, /You can reach me at sam@example\.com or 416 555 0100; I prefer by text message\./)
assert.match(msg, /\(Sent with Autinerary\.\)$/)
assert.ok(msg.length <= 1200)
assert.doesNotMatch(formMessage({ ...input, extras: NO_EXTRAS }), /What I'm looking for|or \d/, 'nothing they didn’t give')
assert.equal(formSubject(input), 'New client request: Sam Lee')

console.log('requests: all passed')
