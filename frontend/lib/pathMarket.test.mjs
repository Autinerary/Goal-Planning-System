// Run from frontend/: node --experimental-strip-types lib/pathMarket.test.mjs
import assert from 'node:assert/strict'
import {
  NO_FILTERS, awaitingFor, communityModel, facetCounts, foundationsModel, isFiltered, lifeAreasOf, matches, sortModels,
  startSeed, userNormIds,
} from './pathMarket.ts'

const cat = (key, title, focus, extra = {}) => ({
  key, title, blurb: `${title} blurb`, focusCategory: focus, examples: [`${title} idea 1`, `${title} idea 2`],
  lifeAreas: lifeAreasOf(key, extra.lifeAreas, focus),
  foundations: { description: `${title} starter`, seedGoals: extra.seedGoals || [`${title} goal`], status: extra.status || 'live' },
})
const cats = [
  cat('med-sci', 'Medicine & Science', 'education', { seedGoals: ['Get into a science/medicine program', 'Build research experience'] }),
  cat('career', 'Career & Workplace', 'career'),
  cat('entrepreneurship', 'Entrepreneurship & Neurodivergence', 'career', { status: 'coming', seedGoals: [] }),
  cat('veganism', 'Plant-Based Living', 'health', { status: 'coming', seedGoals: [] }),
  cat('living', 'Independent Living', 'other'),
]
const byKey = Object.fromEntries(cats.map((c) => [c.key, c]))

// ── Life categories: the database's, else STEP 85's, else the focus ──
assert.deepEqual(byKey['med-sci'].lifeAreas, ['education', 'career'])
assert.deepEqual(lifeAreasOf('med-sci', ['health'], 'education'), ['health'])
assert.deepEqual(lifeAreasOf('new-one', [], 'relationships'), ['relationships'])
assert.deepEqual(lifeAreasOf('new-one', ['bogus'], 'other'), [])

// ── Each model a whole path, with a name of its own ──
const f = foundationsModel(byKey['med-sci'])
assert.equal(f.name, 'Medicine & Science Foundations')
assert.deepEqual(f.races, [
  { name: 'Get into a science/medicine program', area: 'education', milestones: [] },
  { name: 'Build research experience', area: 'education', milestones: [] },
])
assert.deepEqual(f.stepIdeas, ['Medicine & Science idea 1', 'Medicine & Science idea 2'])
assert.deepEqual(f.contributors, ['Autinerary team'])
// "Other"-focused categories put their races in their first life category.
assert.equal(foundationsModel(byKey.living).races[0].area, 'barrier')

const jet = communityModel({
  id: 'j1', name: 'Model Jet', categoryKey: 'recovery', categoryKeys: ['entrepreneurship'], description: 'ADHD, OCD and mood together.',
  seedGoals: ['Build one routine'], status: 'pending', norms: ['adhd', 'ocd', 'depression'], connectionTypes: ['self_diagnosed'],
  races: [], people: [], contributors: ['Odosa'], isOwn: false,
}, byKey)
assert.equal(jet.status, 'pending')
assert.deepEqual(jet.categoryKeys, ['entrepreneurship'])
assert.deepEqual(jet.races, [{ name: 'Build one routine', area: 'career', milestones: [] }])
assert.deepEqual(jet.contributors, ['Odosa'])
const madeUp = communityModel({
  id: 'w1', name: 'Model W', categoryKey: 'career', description: 'd', seedGoals: [], status: 'live', contributor: 'W',
  races: [{ name: 'Get a job', area: 'career', milestones: ['Update resume', 3, ''] }, { name: '' }],
  people: [{ role: 'Mentor', note: 'weekly' }, { role: '' }],
}, byKey)
assert.deepEqual(madeUp.categoryKeys, ['career'])
assert.deepEqual(madeUp.races, [{ name: 'Get a job', area: 'career', milestones: ['Update resume'] }])
assert.deepEqual(madeUp.people, [{ role: 'Mentor', note: 'weekly' }])
assert.deepEqual(madeUp.contributors, ['W'])

const models = sortModels([jet, madeUp, ...cats.map(foundationsModel)], cats.map((c) => c.key))
// Available first, then coming soon, then waiting for review.
assert.deepEqual(models.map((m) => m.status), ['live', 'live', 'live', 'live', 'coming', 'coming', 'pending'])

// ── Filters, the way ResourceHub's work ──
const pick = (filters) => models.filter((m) => matches(m, { ...NO_FILTERS, ...filters }, byKey)).map((m) => m.name).sort()
assert.ok(!isFiltered(NO_FILTERS) && isFiltered({ ...NO_FILTERS, q: 'x' }))
// Career takes everything under it: Medicine & Science is under Career and Education.
assert.deepEqual(pick({ areas: ['career'] }), ['Career & Workplace Foundations', 'Entrepreneurship & Neurodivergence Foundations', 'Medicine & Science Foundations', 'Model Jet', 'Model W'])
assert.deepEqual(pick({ areas: ['education'] }), ['Medicine & Science Foundations'])
// A specialised category narrows its life category.
assert.deepEqual(pick({ areas: ['career'], categories: ['entrepreneurship'] }), ['Entrepreneurship & Neurodivergence Foundations', 'Model Jet'])
// Veganism is under Health (and Independent Living, under Norms and Health).
assert.deepEqual(pick({ areas: ['health'] }), ['Independent Living Foundations', 'Plant-Based Living Foundations'])
// Norms and connection types.
assert.deepEqual(pick({ norms: ['adhd'] }), ['Model Jet'])
assert.deepEqual(pick({ connections: ['self_diagnosed'] }), ['Model Jet'])
assert.deepEqual(pick({ norms: ['autism'] }), [])
assert.deepEqual(pick({ status: ['coming'] }), ['Entrepreneurship & Neurodivergence Foundations', 'Plant-Based Living Foundations'])
assert.deepEqual(pick({ q: 'resume' }), ['Model W'])
assert.deepEqual(pick({ q: 'science' }), ['Medicine & Science Foundations'])

const counts = facetCounts(models, NO_FILTERS, byKey)
assert.equal(counts.areas.career, 5)
assert.equal(counts.categories.entrepreneurship, 2)
assert.equal(counts.norms.adhd, 1)
assert.equal(counts.connections.self_diagnosed, 1)
assert.equal(counts.status.pending, 1)

// ── Pathways still waiting for content follow the category filters ──
assert.ok(awaitingFor({ ...NO_FILTERS, categories: ['entrepreneurship'] }, byKey).some((p) => p.name === 'Model Jet'))
assert.ok(!awaitingFor({ ...NO_FILTERS, areas: ['education'] }, byKey).some((p) => p.name === 'Addictions'))
assert.equal(awaitingFor({ ...NO_FILTERS, norms: ['adhd'] }, byKey).length, 0)
assert.equal(awaitingFor(NO_FILTERS, byKey).length, 16)

// ── "Match my norms": setup's labels as ResourceHub's ids ──
assert.deepEqual(userNormIds(['ADHD', 'Racialized Person (Visible Minority)', 'Limited Income', 'Food Insecurity', 'Unknown']), ['adhd', 'race_visible_minority', 'socioeconomic'])

// ── Start this Path: chosen races in their own areas, with their chosen steps ──
const seed = startSeed(f, byKey['med-sci'], ['Build research experience'], { 'Build research experience': ['Medicine & Science idea 1', 'Medicine & Science idea 1', ''], 'Not chosen': ['x'] })
assert.deepEqual(seed.selectedGoals, ['Build research experience'])
assert.deepEqual(seed.selectedRaces, [{ goal: 'Build research experience', area: 'education' }])
assert.deepEqual(seed.stepIdeas, { 'Build research experience': ['Medicine & Science idea 1'] })
assert.deepEqual(seed.goals, ['Get into a science/medicine program', 'Build research experience'])
assert.equal(seed.title, 'Medicine & Science Foundations')
assert.equal(seed.key, 'med-sci:med-sci-foundations')
console.log('pathMarket: ok')
