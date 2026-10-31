// Run from servicehub-mvp/: node --experimental-strip-types lib/external-ratings/google.test.mjs
import assert from 'node:assert/strict'
import { googleRatingsOn, sameService, findPlaceId, fetchGoogleRating } from './google.ts'

// Off unless both are set.
assert.equal(googleRatingsOn({}), false)
assert.equal(googleRatingsOn({ GOOGLE_RATINGS: 'on' }), false)
assert.equal(googleRatingsOn({ GOOGLE_PLACES_API_KEY: 'k' }), false)
assert.equal(googleRatingsOn({ GOOGLE_RATINGS: 'on', GOOGLE_PLACES_API_KEY: 'k' }), true)

// A match needs the name and the place.
const listing = { name: 'Autism Ontario - Windsor Essex Chapter', city: 'Windsor', province: 'ON' }
assert.equal(sameService(listing, { displayName: { text: 'Autism Ontario Windsor-Essex' }, formattedAddress: '123 Main St, Windsor, ON N9A 1A1, Canada' }), true)
assert.equal(sameService(listing, { displayName: { text: 'Autism Ontario Windsor-Essex' }, formattedAddress: '5 Rue X, Montréal, QC H1A 1A1, Canada' }), false)
assert.equal(sameService(listing, { displayName: { text: 'Windsor Pizza Palace' }, formattedAddress: '1 Pizza Rd, Windsor, ON' }), false)
assert.equal(sameService(listing, { displayName: {}, formattedAddress: 'Windsor, ON' }), false)
// A program page named for its organisation is not the organisation's place.
assert.equal(sameService({ name: 'Awards and Funding (Autism Ontario)', city: 'Toronto', province: 'ON' }, { displayName: { text: 'Autism Ontario' }, formattedAddress: '1179 King St W, Toronto, ON, Canada' }), false)
assert.equal(sameService({ name: 'Autism Ontario', city: 'Toronto', province: 'ON' }, { displayName: { text: 'Autism Ontario' }, formattedAddress: '1179 King St W, Toronto, ON, Canada' }), true)

// The place id is found, and the first plausible result wins; nothing plausible is null.
const reply = (body, ok = true) => async () => ({ ok, json: async () => body })
assert.equal(await findPlaceId(listing, 'k', reply({ places: [{ id: 'WRONG', displayName: { text: 'Bakery' }, formattedAddress: 'Windsor, ON' }, { id: 'RIGHTPLACEID123', displayName: { text: 'Autism Ontario Windsor Essex' }, formattedAddress: 'Windsor, ON' }] })), 'RIGHTPLACEID123')
assert.equal(await findPlaceId(listing, 'k', reply({ places: [] })), null)
assert.equal(await findPlaceId(listing, 'k', reply({}, false)), null)
// The search asks only for ids, names and addresses (the cheap "IDs only" kind), never ratings.
let sent
await findPlaceId(listing, 'k', async (url, init) => { sent = init; return { ok: true, json: async () => ({}) } })
assert.ok(!/rating/i.test(sent.headers['X-Goog-FieldMask']))

// A rating is read live; no rating, or a bad id, is null; a non-https link is dropped.
assert.deepEqual(await fetchGoogleRating('ChIJabcdefghij12', 'k', reply({ rating: 4.6, userRatingCount: 120, googleMapsUri: 'https://maps.google.com/?cid=1' })), { rating: 4.6, count: 120, mapsUri: 'https://maps.google.com/?cid=1' })
assert.equal(await fetchGoogleRating('ChIJabcdefghij12', 'k', reply({ rating: 4.6, userRatingCount: 0 })), null)
assert.equal(await fetchGoogleRating('ChIJabcdefghij12', 'k', reply({})), null)
assert.equal((await fetchGoogleRating('ChIJabcdefghij12', 'k', reply({ rating: 4, userRatingCount: 3, googleMapsUri: 'javascript:alert(1)' }))).mapsUri, null)
assert.equal(await fetchGoogleRating('../../etc/passwd', 'k', reply({ rating: 5, userRatingCount: 1 })), null)
console.log('google ratings: ok')
