// Run from frontend/: node --experimental-strip-types lib/localServices.test.mjs
import assert from 'node:assert/strict'
import { adultOnly, localServices, provinceCode, studentOnly, studies, youthOnly } from './moreTools.ts'
import { howToRequest, isPlace } from './requests.ts'

const reachable = (r) => !isPlace(r.category) && howToRequest(r) !== 'none'
const row = (id, name, extra = {}) => ({
  id, name, description: 'Peer support groups for autistic adults', category: 'Support_group', tags: [], cost_type: 'free', price: null,
  status: 'approved', contact_info: { email: `${id}@example.org` }, location: { city: 'Toronto', province: 'ON' }, ...extra,
})
const step = { name: 'Join a peer support group for autistic adults' }
const opts = (place, extra = {}) => ({ place, student: false, exclude: new Set(), norms: [], ratings: new Map(), limit: 5, reachable, ...extra })
const ids = (rows) => rows.map((r) => r.id)

assert.equal(provinceCode('Ontario'), 'ON')
assert.equal(provinceCode(' on '), 'ON')
assert.equal(provinceCode('British Columbia'), 'BC')
assert.equal(provinceCode(''), '')
assert.equal(provinceCode(null), '')
assert.equal(provinceCode('St. James'), null, 'not a province')

const pool = [
  row('toronto', 'Peer Connect – Adult Group'),
  row('halifax', 'Peer support group, Halifax', { location: { city: 'Halifax', province: 'NS' } }),
  row('national', 'Online peer support for autistic adults', { location: null }),
  row('uoft', 'University of Toronto — Autism peer group'),
  row('park', 'High Park', { category: 'Park', description: 'A park with peer support group meetups for autistic adults' }),
  row('nocontact', 'Peer support drop-in', { contact_info: { email: null, website: null }, source_type: 'openstreetmap', source_url: 'https://www.openstreetmap.org/node/1' }),
  row('odd', 'Peer support, somewhere', { location: { province: 'St. James' } }),
  row('offtopic', 'Tax clinic', { description: 'Free income tax returns', category: 'Organization' }),
  row('oneword', 'Adult tax clinic', { description: 'Free income tax returns for adults', category: 'Organization' }),
  row('cityonly', 'Peer support group for autistic adults (Bedford)', { location: { city: 'Bedford', province: null } }),
]
const markham = { city: 'Markham', province: 'Ontario', lat: 43.87, lng: -79.22 }

let got = ids(localServices(pool, step, opts(markham)))
assert.deepEqual(got.sort(), ['national', 'toronto'], 'their province and national ones; never another province, a student-only service, a place, one with no way to reach it, a non-province, off topic, one shared word only, or a city that isn’t theirs')
assert.ok(ids(localServices(pool, step, opts({ city: 'Bedford', province: 'NS' }))).includes('cityonly'), 'a city alone counts in that city')
got = ids(localServices(pool, step, opts(markham, { student: true })))
assert.ok(got.includes('uoft'), 'a student gets the university’s service')
got = ids(localServices(pool, step, opts(null)))
assert.deepEqual(got, ['national'], 'no province on their profile: national ones only')
got = ids(localServices(pool, step, opts({ province: 'NS' })))
assert.deepEqual(got.sort(), ['halifax', 'national'])
got = ids(localServices(pool, step, opts(markham, { exclude: new Set(['toronto']) })))
assert.deepEqual(got, ['national'], 'not one already among the step’s tools')
assert.equal(localServices(pool, step, opts(markham, { limit: 1 })).length, 1)

// Nearer first.
const near = [
  row('far', 'Peer support group for autistic adults (Ottawa)', { location: { city: 'Ottawa', province: 'ON' }, geo_lat: 45.42, geo_lng: -75.69 }),
  row('close', 'Peer support group for autistic adults (Markham)', { location: { city: 'Markham', province: 'ON' }, geo_lat: 43.88, geo_lng: -79.26 }),
]
assert.deepEqual(ids(localServices(near, step, opts(markham))), ['close', 'far'], 'within 40 km first')
assert.deepEqual(ids(localServices(near, step, opts({ city: 'Ottawa', province: 'ON' }))), ['far', 'close'], 'no map position: the same city first')

assert.equal(studentOnly({ name: 'Cambrian College — Learning Centre', description: '' }), true)
assert.equal(studentOnly({ name: 'Learning Centre', description: 'Tutoring for registered students' }), true)
assert.equal(studentOnly({ name: 'Peer Connect', description: 'For adults' }), false)
assert.equal(studies('I am a student at Seneca and want to finish my diploma'), true)
assert.equal(studies('I want to find work and live on my own'), false)

// For whom: an adult planning for themselves, or a parent for their child.
const ages = [
  row('teens', 'PEERS® for Adolescents', { description: 'Peer support group for autistic teens aged 13 to 17' }),
  row('adults', 'Adult Social Club', { description: 'Peer support group for autistic adults' }),
  row('both', 'Riding centre', { description: 'Peer support group riding for autistic children and adults' }),
]
assert.deepEqual(ids(localServices(ages, step, opts(markham, { forWhom: 'adult' }))).sort(), ['adults', 'both'], 'an adult: never one only for teens')
assert.deepEqual(ids(localServices(ages, { name: 'Join a peer support group for my autistic child' }, opts(markham, { forWhom: 'child' }))).sort(), ['both', 'teens'], 'their child: never one only for adults')
assert.equal(ids(localServices(ages, step, opts(markham, { forWhom: null }))).length, 3, 'not known: all')
assert.equal(youthOnly({ name: 'Sibshops', description: 'For brothers and sisters aged 8 to 13' }), true)
assert.equal(youthOnly({ name: 'Family program', description: 'For children and adults' }), false)
assert.equal(adultOnly({ name: 'Adult Social Club', description: 'For autistic adults' }), true)
assert.equal(adultOnly({ name: 'Caregiver support', description: 'For adults caring for a child' }), false)

console.log('localServices: all passed')
