// Run from frontend/: node --experimental-strip-types lib/positive.test.mjs
import assert from 'node:assert/strict'
import { GENERAL_NOTES, NORM_NOTES, noteFor, normIds, today } from './positive.ts'

// The same note all day in one place; places and days differ.
assert.equal(noteFor('2026-10-18', '/calendar'), noteFor('2026-10-18', '/calendar'))
const places = ['/', '/calendar', '/path', '/tasks', '/hare-world', '/search', '/resources', '/shop', '/community', '/settings']
assert.ok(new Set(places.map((p) => noteFor('2026-10-18', p))).size >= 4, 'notes vary between places')
const days = Array.from({ length: 14 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
assert.ok(new Set(days.map((d) => noteFor(d, '/calendar'))).size >= 5, 'notes vary between days')

// With a norm, some days bring a note for it; without one, only general notes.
const withAdhd = days.map((d) => noteFor(d, '/path', ['adhd']))
assert.ok(withAdhd.some((n) => NORM_NOTES.adhd.includes(n)), 'norm notes appear')
assert.ok(withAdhd.some((n) => GENERAL_NOTES.includes(n)), 'general notes still appear')
assert.ok(days.every((d) => GENERAL_NOTES.includes(noteFor(d, '/path'))))
assert.ok(days.every((d) => GENERAL_NOTES.includes(noteFor(d, '/path', ['not-a-norm']))))

// The voice guide (docs/voice.md): no deficit words, no "barrier", no urgency, no exclamation marks.
const all = [...GENERAL_NOTES, ...Object.values(NORM_NOTES).flat()]
for (const n of all) {
  assert.doesNotMatch(n, /suffer|disorder|deficit|barrier|despite|hurry|now or never|don.t miss|streak|!/i, n)
  assert.ok(n.length <= 120, `short: ${n}`)
}

// Profiles store ids or labels.
assert.deepEqual(normIds(['ADHD', 'Autism Spectrum', 'adhd', 'LGBTQ+', 'Prefer not to share', 'sensory_deaf']), ['adhd', 'autism', 'lgbtq', 'sensory_deaf'])

assert.match(today(new Date('2026-11-01T03:30:00Z')), /^2026-10-31$/)
console.log('positive: ok')
