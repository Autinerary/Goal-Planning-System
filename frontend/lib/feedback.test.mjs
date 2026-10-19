// Run from frontend/: node --experimental-strip-types lib/feedback.test.mjs
import assert from 'node:assert/strict'
import { FEEDBACK_EMAIL, FEEDBACK_KINDS, feedbackMailto } from './feedback.ts'
import * as hub from '../../servicehub-mvp/lib/feedback.ts'

const subject = (href) => decodeURIComponent(href.split('subject=')[1].split('&')[0])
const body = (href) => decodeURIComponent(href.split('body=')[1])

// Every email goes to heydevs@, labelled by what it is and what it is about (the products round, Goal 11).
assert.equal(FEEDBACK_EMAIL, 'heydevs@autinerary.ca')
assert.ok(feedbackMailto().startsWith('mailto:heydevs@autinerary.ca?subject='))
assert.equal(subject(feedbackMailto()), '[Feedback] Feedback about Autinerary')
assert.equal(subject(feedbackMailto('', { kind: 'bug', about: 'app' })), '[Bug] [App] Feedback about Autinerary')
assert.equal(subject(feedbackMailto('', { kind: 'recommendation', about: 'resourcehub' })), '[Recommendation] [ResourceHub] Feedback about Autinerary')
assert.equal(subject(feedbackMailto('', { kind: 'listing', about: 'product', item: 'Loop Engage' })), '[Listing] [Product] Loop Engage')
// A long name is cut, so the subject stays short.
assert.equal(subject(feedbackMailto('', { kind: 'listing', about: 'service', item: 'x'.repeat(200) })).length, '[Listing] [Service] '.length + 80)

// The page goes in the body, under a template for the kind.
const bug = body(feedbackMailto('https://app.autinerary.ca/path', { kind: 'bug' }))
assert.ok(bug.includes('What happened:') && bug.includes('What you expected:'))
assert.ok(bug.includes('The page I was on: https://app.autinerary.ca/path'))
assert.ok(body(feedbackMailto('', { kind: 'listing' })).includes('What is wrong or missing in this listing:'))

// The four kinds people choose from, and ResourceHub's copy says the same.
assert.deepEqual(FEEDBACK_KINDS.map((k) => k.id), ['bug', 'idea', 'question', 'recommendation'])
assert.deepEqual(hub.FEEDBACK_KINDS, FEEDBACK_KINDS)
for (const kind of ['bug', 'idea', 'question', 'recommendation', 'listing', 'general']) {
  assert.equal(hub.feedbackMailto('https://x', { kind, about: 'article', item: 'A' }), feedbackMailto('https://x', { kind, about: 'article', item: 'A' }), kind)
}

console.log('feedback: ok')
