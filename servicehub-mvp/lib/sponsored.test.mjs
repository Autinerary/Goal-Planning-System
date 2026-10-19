// Run from servicehub-mvp/: node --experimental-strip-types lib/sponsored.test.mjs
import assert from 'node:assert/strict'
import { adFree, isPlacement, pickPromotion, viewerKey } from './sponsored.ts'

// A stand-in for the database: each table answers what the test gives it.
function fakeDb(tables, { failColumns = [] } = {}) {
  return {
    from(table) {
      const q = { table, filters: [], cols: '' }
      const chain = {
        select(cols) { q.cols = cols; return chain },
        eq(col, val) { q.filters.push((r) => r[col] === val); return chain },
        limit() { return chain },
        maybeSingle() { return Promise.resolve({ data: (tables[table] || []).filter((r) => q.filters.every((f) => f(r)))[0] ?? null, error: null }) },
        then(ok, bad) {
          if (failColumns.some((c) => q.cols.includes(c))) return Promise.resolve({ data: null, error: { code: '42703', message: `column promotions.${failColumns[0]} does not exist` } }).then(ok, bad)
          return Promise.resolve({ data: (tables[table] || []).filter((r) => q.filters.every((f) => f(r))), error: null }).then(ok, bad)
        },
      }
      return chain
    },
  }
}

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
const place = { id: 'r1', name: 'Calm Clinic', category: 'Therapist', location: { city: 'Guelph' }, status: 'approved' }
const promo = (o) => ({ id: 'p1', item_id: 'r1', item_kind: 'resource', status: 'active', headline: 'Openings this month', body: null, image_url: null, categories: ['therapist'], keywords: ['speech therapy'], provinces: [], starts_on: null, ends_on: null, placements: ['search', 'tidbits'], bid_cents: 50, budget_cents: 1000, spent_cents: 0, ...o })

// Matched by its words, or its kind of place.
let db = fakeDb({ promotions: [promo()], resources: [place] })
assert.equal((await pickPromotion(db, { placement: 'search', text: 'speech therapy for my son' }))?.resource.city, 'Guelph')
assert.equal((await pickPromotion(db, { placement: 'search', text: 'anything', categories: ['Therapist'] }))?.id, 'p1')
assert.equal(await pickPromotion(db, { placement: 'search', text: 'speech' }), null)   // every word of a keyword
assert.equal(await pickPromotion(db, { placement: 'search', text: '' }), null)
// Only in the places it asked for.
assert.equal(await pickPromotion(db, { placement: 'paths', text: 'speech therapy' }), null)
// Not once its budget is spent, outside its dates or province, or for a place that isn't approved.
for (const o of [{ spent_cents: 1000 }, { starts_on: '2999-01-01' }, { ends_on: '2000-01-01' }, { provinces: ['BC'] }]) {
  assert.equal(await pickPromotion(fakeDb({ promotions: [promo(o)], resources: [place] }), { placement: 'search', text: 'speech therapy', province: 'ON' }), null, JSON.stringify(o))
}
assert.equal(await pickPromotion(fakeDb({ promotions: [promo({ ends_on: today })], resources: [place] }), { placement: 'search', text: 'speech therapy' }) !== null, true)
assert.equal(await pickPromotion(fakeDb({ promotions: [promo()], resources: [{ ...place, status: 'hidden' }] }), { placement: 'search', text: 'speech therapy' }), null)
// A promotion without a budget (arranged with the team) has no limit.
assert.ok(await pickPromotion(fakeDb({ promotions: [promo({ budget_cents: null, spent_cents: 5000 })], resources: [place] }), { placement: 'search', text: 'speech therapy' }))

// Several match: in proportion to what a click is worth to each.
db = fakeDb({ promotions: [promo({ id: 'cheap', bid_cents: 10 }), promo({ id: 'dear', bid_cents: 90 })], resources: [place] })
const wins = { cheap: 0, dear: 0 }
for (let i = 0; i < 2000; i++) wins[(await pickPromotion(db, { placement: 'search', text: 'speech therapy' })).id]++
assert.ok(wins.dear > wins.cheap * 4 && wins.cheap > 50, JSON.stringify(wins))

// Before STEP 83 (no places or bids): beside searches only.
db = fakeDb({ promotions: [promo()], resources: [place] }, { failColumns: ['placements'] })
assert.ok(await pickPromotion(db, { placement: 'search', text: 'speech therapy' }))
assert.equal(await pickPromotion(db, { placement: 'tidbits', text: 'speech therapy' }), null)

// Paying, or free access through an organization, means none.
const future = new Date(Date.now() + 86400000).toISOString()
assert.equal(await adFree(fakeDb({}), null), false)
assert.equal(await adFree(fakeDb({ subscriptions: [{ user_id: 'u1', status: 'active' }] }), 'u1'), true)
assert.equal(await adFree(fakeDb({ subscriptions: [{ user_id: 'u1', status: 'canceled' }] }), 'u1'), false)
assert.equal(await adFree(fakeDb({ access_grants: [{ user_id: 'u1', status: 'active', ends_at: future }] }), 'u1'), true)
assert.equal(await adFree(fakeDb({ access_grants: [{ user_id: 'u1', status: 'active', ends_at: '2000-01-01T00:00:00Z' }] }), 'u1'), false)

// The viewer key: the same person on the same day, never the person.
const h = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'user-agent': 'Test' })
assert.equal(viewerKey('u1', h), viewerKey('u1', new Headers()))
assert.notEqual(viewerKey('u1', h), viewerKey('u2', h))
assert.equal(viewerKey(null, h), viewerKey(null, new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Test' })))
assert.match(viewerKey(null, h), /^[0-9a-f]{64}$/)
assert.ok(!viewerKey(null, h).includes('203'))

assert.ok(isPlacement('tidbits') && !isPlacement('billboards'))
console.log('sponsored: ok')
