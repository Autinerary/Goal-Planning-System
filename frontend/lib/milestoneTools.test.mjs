// Run from frontend/: node --experimental-strip-types lib/milestoneTools.test.mjs
import assert from 'node:assert/strict'
import {
  MAX_TOOLS, canRate, cleanEdits, costLabel, excludedKeys, hubPath, hubSearchPath, nextStatus, resourceIdOf,
  toolKey, toolsFromRecs, visibleTools, withAdded, withRemoved, withRestored,
} from './milestoneTools.ts'
import { fit, isSelfListing, normWords, rankMore, typeFor, words } from './moreTools.ts'
import { labelsFor, normLabel } from './resourceLabels.ts'
import { tagLabel } from './filters/tags.ts'

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const tool = (n, extra = {}) => ({ id: `sh_${U(n)}`, resourceId: U(n), name: `Tool ${n}`, ...extra })

// ── Statuses: the chosen one again clears it (the bug: it alternated) ──
assert.equal(nextStatus(null, 'wishlist'), 'wishlist')
assert.equal(nextStatus('wishlist', 'wishlist'), null)
assert.equal(nextStatus('wishlist', 'current'), 'current')
assert.equal(nextStatus('current', 'current'), null)
assert.equal(nextStatus('current', 'past'), 'past')
assert.equal(nextStatus(undefined, 'past'), 'past')
// Rating only once it has been used.
assert.ok(canRate('past') && !canRate('current') && !canRate('wishlist') && !canRate(null))

// ── One key per tool: the ResourceHub resource ──
assert.equal(resourceIdOf({ id: `sh_${U(1)}` }), U(1))
assert.equal(resourceIdOf({ id: 'kb_3', url: `https://hub.example/resources/${U(2)}` }), U(2))
assert.equal(resourceIdOf({ id: 'kb_3', url: 'https://example.org' }), null)
assert.equal(toolKey({ id: 'kb_3' }), 'kb_3')
assert.equal(toolKey(tool(4)), U(4))
// Two tools never share a rating key (the bug: rating one rated them all).
assert.notEqual(toolKey(tool(1)), toolKey(tool(2)))

// ── The list: five at most, removed ones gone, added ones after ──
const base = [1, 2, 3, 4, 5, 6].map((n) => tool(n))
assert.deepEqual(visibleTools(base).map((t) => t.name), ['Tool 1', 'Tool 2', 'Tool 3', 'Tool 4', 'Tool 5'])
let edits = cleanEdits(null)
assert.deepEqual(edits, { removed: [], added: [] })
edits = withRemoved(edits, U(2))
assert.deepEqual(visibleTools(base, edits).map((t) => t.name), ['Tool 1', 'Tool 3', 'Tool 4', 'Tool 5'])
// The sixth doesn't appear by itself after a removal: only "Recommend more" adds.
assert.ok(!visibleTools(base, edits).some((t) => t.name === 'Tool 6'))
edits = withAdded(base, edits, tool(9))
const shown = visibleTools(base, edits)
assert.equal(shown.length, MAX_TOOLS)
assert.equal(shown[4].name, 'Tool 9')
assert.equal(shown[4].added, true)
// Full: adding again changes nothing.
assert.deepEqual(withAdded(base, edits, tool(10)), edits)
// Removing an added one, and putting a removed one back.
const less = withRemoved(edits, U(9))
assert.equal(less.added.length, 0)
assert.deepEqual(withRestored(less, U(2)).removed, [U(9)])
// Not suggested again: shown, removed, or already suggested.
const ex = excludedKeys(base, edits)
assert.ok(ex.has(U(1)) && ex.has(U(2)) && ex.has(U(9)) && !ex.has(U(6)))
// Stored edits are cleaned.
assert.deepEqual(cleanEdits({ removed: ['a', 3], added: [{ id: 'x', name: 'X' }, { nope: true }] }), { removed: ['a'], added: [{ id: 'x', name: 'X' }] })

// ── The plan's own list: free first, then the cheapest; ties keep the agent's order ──
const recs = [
  { id: 'a', name: 'Paid 40', price: 40, costType: 'paid', type: 'service' },
  { id: 'b', name: 'Unknown', type: 'weird' },
  { id: 'c', name: 'Free', costType: 'free' },
  { id: 'd', name: 'Paid 10', price: '10' },
  { nope: true },
]
assert.deepEqual(toolsFromRecs(recs).map((t) => t.name), ['Free', 'Paid 10', 'Paid 40', 'Unknown'])
assert.equal(toolsFromRecs(recs)[3].type, 'other')
assert.deepEqual(toolsFromRecs(null), [])
// Older plans hold our own listing; it isn't shown.
assert.deepEqual(toolsFromRecs([{ id: 'x', name: 'Autinerary' }, { id: 'y', name: 'ResourceHub guide' }, { id: 'z', name: 'Study hall' }]).map((t) => t.name), ['Study hall'])

// ── Links: ResourceHub, not the service's own site ──
assert.equal(hubPath(tool(7, { url: 'https://service.example' })), `/resources/${U(7)}`)
assert.equal(hubPath({ id: 'kb_1', name: 'Focus timer' }), '/search?q=Focus+timer')
assert.equal(hubSearchPath('Set up a structured study schedule!'), '/search?q=Set+structured+study+schedule')
assert.equal(hubSearchPath('a'), '/search')

// ── Cost ──
assert.equal(costLabel({ costType: 'free' }), 'Free')
assert.equal(costLabel({ price: 0 }), 'Free')
assert.equal(costLabel({ price: '12.5' }), '$12.50')
assert.equal(costLabel({ costType: 'paid' }), 'Paid')
assert.equal(costLabel({ price: null }), null)

// ── Recommend more ──
assert.deepEqual([...words('Study schedules and the support services')].sort(), ['schedule', 'study'])
assert.ok(normWords(['Sensory Impairment', 'ADHD']).has('adhd') && normWords(['Sensory Impairment']).has('sensory'))
assert.equal(typeFor('app'), 'product')
assert.equal(typeFor('Education Support'), 'other')
const pool = [
  { id: U(21), name: 'Study skills workshop', description: 'Weekly study schedule coaching', category: 'Education Support', tags: [], cost_type: 'paid', price: 40 },
  { id: U(22), name: 'Campus study hall', description: 'Free quiet study space', category: 'Education Support', tags: [], cost_type: 'free', price: null },
  { id: U(23), name: 'Dog park', description: 'Off-leash area', category: 'park', tags: [], cost_type: 'free', price: null },
  { id: U(24), name: 'Shown already', description: 'Study schedule help', category: 'x', tags: [], cost_type: 'free', price: null },
  { id: U(25), name: 'Rated for ADHD', description: 'Coaching', category: 'x', tags: [], cost_type: null, price: null },
]
const ratings = new Map([[U(25), { sum: 9, count: 2, norms: { adhd: 2 } }]])
const more = rankMore(pool, { name: 'Set up a structured study schedule' }, { exclude: new Set([U(24)]), norms: ['ADHD'], ratings, limit: 5, hubUrl: 'https://hub.example/' })
// Free first among the ones that fit; nothing that shares no words or norms; nothing excluded.
assert.deepEqual(more.map((t) => t.name), ['Campus study hall', 'Study skills workshop', 'Rated for ADHD'])
assert.equal(more[0].url, `https://hub.example/resources/${U(22)}`)
assert.equal(more[0].resourceId, U(22))
assert.equal(more[2].rating, 4.5)
assert.equal(rankMore(pool, { name: 'Go on' }, { exclude: new Set(), norms: [], ratings, limit: 1, hubUrl: 'x' }).length, 0)
assert.equal(fit(pool[2], words('study schedule'), normWords([]), undefined), 0)
// Never our own listing.
assert.ok(isSelfListing({ name: 'ResourceHub study guide' }) && isSelfListing({ name: 'x', is_first_party: true }) && !isSelfListing({ name: 'Study hall' }))
assert.equal(rankMore([{ ...pool[1], name: 'Autinerary study hall' }], { name: 'study' }, { exclude: new Set(), norms: [], ratings, limit: 3, hubUrl: 'x' }).length, 0)

// ── Labels, from ResourceHub's own data ──
const labels = labelsFor(
  { category: 'Education Support', tags: ['funding', 'charity', 'funding'], cost_type: 'free', age_ranges: ['young_adults_18_30'] },
  { hearing_impairment: 1, adhd: 3 },
  tagLabel,
)
assert.deepEqual(labels, {
  kind: 'Service',
  type: 'Education Support',
  tags: ['Funding resources', 'Charity'],
  norms: ['ADHD', 'Hearing impairment'],
  cost: 'Free',
  ages: ['Young adults (18-30)'],
})
assert.equal(labelsFor({ category: 'app', tags: null, cost_type: null, price: 5 }).kind, 'Product')
assert.equal(labelsFor({ category: 'app', tags: null, cost_type: null, price: 5 }).cost, 'Paid')
assert.equal(normLabel('sensory_deaf'), 'Deaf or Hard of Hearing')

console.log('milestoneTools: ok')
