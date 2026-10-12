// "How it works" for each page (lib/pageGuides.ts, Riipen Labs Group 23). Run from frontend/:
//   node --experimental-strip-types lib/pageGuides.test.mjs
import assert from 'node:assert/strict'
import { pageGuideFor, GUIDE_PATTERNS } from './pageGuides.ts'

const pages = ['/path', '/milestones/m1', '/milestones', '/calendar', '/races', '/tasks', '/pit-stop', '/hare-world', '/reflection',
  '/recommend-choices', '/tools', '/stats', '/ideal-self', '/family', '/path-market', '/profile/settings', '/profile', '/kits/school', '/start', '/help', '/assistant']
for (const p of pages) {
  const g = pageGuideFor(p)
  assert.ok(g, `${p} has a guide`)
  // What it is for, and how: never just labels.
  assert.ok(g.purpose.length > 30 && g.steps.length >= 1, p)
  for (const t of [g.name, g.purpose, ...g.steps, g.connects || '']) assert.doesNotMatch(t, /\bbarriers?\b/i, 'The app says norms')
  if (g.tourPart !== undefined) assert.ok(g.tourPart >= 1 && g.tourPart <= 5, p)
}
// The most specific match wins: a step's page, Settings inside Your profile.
assert.equal(pageGuideFor('/milestones/abc').name, 'A step of your plan')
assert.equal(pageGuideFor('/milestones').name, 'Milestone View')
assert.equal(pageGuideFor('/profile/settings').name, 'Settings')
assert.equal(pageGuideFor('/profile').name, 'Your profile')
// The tour starts at the part about the page it was opened from.
assert.equal(pageGuideFor('/path').tourPart, 1)
assert.equal(pageGuideFor('/calendar').tourPart, 3)
assert.equal(pageGuideFor('/nowhere'), null)
assert.ok(GUIDE_PATTERNS.length >= 20)

console.log('pageGuides: all passed')
