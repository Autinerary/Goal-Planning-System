// Run from frontend/: node --experimental-strip-types lib/trainingSet.test.mjs
//
// The training set file (lib/trainingSet.ts): one chat example per line, our question and the person's scrubbed
// answer only (never what they wrote before scrubbing), emptied items left out; the summary of what was replaced;
// and the calls to the backend, with the server's own words when it refuses.
import assert from 'node:assert/strict'
import { SYSTEM_PROMPT, chatExample, foundSummary, itemKey, listItems, recordConsent, scrubItems, scrubTexts, toJsonl, trainingFileName } from './trainingSet.ts'

const items = [
  { kind: 'reflection', id: 'r1:0', prompt: 'What went well?', before: 'I swam with Priya.', after: 'I swam with [NAME].\n' },
  { kind: 'note', id: 'n1', prompt: 'What would you do differently next time?', before: 'Ask Sam', after: '   ' },
  { kind: 'note', id: 'n2', prompt: 'What went well that’s worth doing again?', before: 'x', after: 'Going "early" helped.' },
]

// The file.
const jsonl = toJsonl(items)
const lines = jsonl.trimEnd().split('\n')
assert.equal(lines.length, 2, 'an item emptied by editing is left out')
assert.ok(jsonl.endsWith('\n'))
assert.deepEqual(JSON.parse(lines[0]), {
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: 'What went well?' },
    { role: 'assistant', content: 'I swam with [NAME].' },
  ],
})
assert.equal(JSON.parse(lines[1]).messages[2].content, 'Going "early" helped.')
assert.ok(!jsonl.includes('Priya') && !jsonl.includes('Sam'), 'only the scrubbed text goes in the file')
assert.equal(toJsonl([]), '')
assert.deepEqual(chatExample({ prompt: 'q', after: ' a ' }).messages.map((m) => m.role), ['system', 'user', 'assistant'])
assert.equal(trainingFileName(new Date('2026-10-31T23:00:00Z')), 'my-training-set-2026-10-31.jsonl')
assert.equal(itemKey({ kind: 'note', id: 'n1' }), 'note:n1')

// What was replaced, in words.
assert.equal(foundSummary({}), 'Nothing found to replace')
assert.equal(foundSummary({ name: 1 }), 'Replaced 1 name')
assert.equal(foundSummary({ name: 2, school: 1, date_of_birth: 1 }), 'Replaced 2 names, 1 school and 1 date of birth')
assert.equal(foundSummary({ diagnosis: 3, phone: 0 }), 'Replaced 3 diagnoses')

// Calls to the backend: the person's token, only kinds and ids sent, and the server's refusal as it is.
const calls = []
const fake = (status, body) => async (url, init) => {
  calls.push({ url, init })
  return { ok: status < 400, status, json: async () => body }
}
await listItems('http://api/', 'tok', fake(200, { items: [] }))
assert.equal(calls[0].url, 'http://api/api/training/items')
assert.equal(calls[0].init.method, 'GET')
assert.equal(calls[0].init.headers.Authorization, 'Bearer tok')
await scrubItems('http://api', 'tok', [{ kind: 'note', id: 'n1', text: 'secret words', label: 'x' }], fake(200, { items: [] }))
assert.deepEqual(JSON.parse(calls[1].init.body), { items: [{ kind: 'note', id: 'n1' }] })
await scrubTexts('http://api', 'tok', ['edited'], fake(200, { texts: [] }))
assert.deepEqual(JSON.parse(calls[2].init.body), { texts: ['edited'] })
await recordConsent('http://api', 'tok', items, 'v1', fake(200, { saved: true }))
assert.deepEqual(JSON.parse(calls[3].init.body), { items: [{ kind: 'reflection', id: 'r1:0' }, { kind: 'note', id: 'n1' }, { kind: 'note', id: 'n2' }], scrubberVersion: 'v1' })
assert.ok(!calls[3].init.body.includes('swam'), 'consent never carries text')
await assert.rejects(recordConsent('http://api', 'tok', items, 'old', fake(409, { detail: 'The scrubber has changed since you checked these. Please check them again.' })), /scrubber has changed/)
await assert.rejects(listItems('http://api', 'tok', fake(500, {})), /didn’t work/)

console.log('training set: ok')
