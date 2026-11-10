// Run from frontend/: node --experimental-strip-types lib/aiSafety.test.mjs
//
// The safety check as the browser sees it (lib/aiSafety.ts): the crisis phrases are the server's own (one list,
// backend/tests/crisis_phrases.json), a figure of speech is not a crisis, what the server says is read safely, and the
// label on an AI answer says what it is, whether it was checked, and what was hidden.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

// lib/aiSafety.ts imports its neighbours without ".ts", as the app does; Node needs the extension, so add it here.
register('data:text/javascript,' + encodeURIComponent(
  'export async function resolve(s, c, next) { try { return await next(s, c) } catch (e) { ' +
  'if (s.startsWith(".") && !/\\.[a-z]+$/.test(s)) return next(s + ".ts", c); throw e } }'))
const { aboutAnswer, crisisIn, hiddenNotice, hiddenWords, readSafety, steerIn, summarise } = await import('./aiSafety.ts')

// The server's own patterns, in JavaScript, on the server's own phrase lists.
const phrases = JSON.parse(readFileSync(new URL('../../backend/tests/crisis_phrases.json', import.meta.url), 'utf8'))
for (const text of phrases.care) assert.ok(crisisIn(text), `caught, as on the server: ${text}`)
for (const text of phrases.not_care) assert.ok(!crisisIn(text), `not a crisis: ${text}`)
const rules = JSON.parse(readFileSync(new URL('../../backend/tests/rule_phrases.json', import.meta.url), 'utf8'))
for (const text of rules.sets_rules_aside.match) assert.equal(steerIn(text), 'jailbreak', text)
for (const text of rules.scam.match) assert.equal(steerIn(text), 'exploitation', text)
for (const text of [...rules.sets_rules_aside.no_match, ...rules.scam.no_match]) assert.equal(steerIn(text), null, text)

// Read safely: only what the server can say.
assert.equal(readSafety(null), null)
assert.equal(readSafety({ by: 'someone' }), null)
assert.deepEqual(readSafety({ by: 'openai', care: 'yes', hidden: ['phone', 3], rewritten: true }),
  { by: 'openai', care: false, hidden: ['phone'], rewritten: true, dropped: false })

// What was hidden, in words.
assert.equal(hiddenWords(['phone']), 'the phone number')
assert.equal(hiddenWords(['email', 'phone', 'password']), 'the email address, phone number and password')
assert.equal(hiddenNotice(['id_number']), 'We hid the ID number in your message from the AI. It answered the rest.')
assert.equal(hiddenNotice([]), '')

// About this answer.
const cloud = aboutAnswer({ model: 'GPT-4o mini' }, { by: 'openai', hidden: ['phone', 'email'] })
assert.equal(cloud[0], 'Written by AI (GPT-4o mini), from what you wrote and what you chose to share.')
assert.equal(cloud[1], 'It was checked for safety before you saw it.')
assert.equal(cloud[2], 'Your phone number and email address were hidden from the AI.')
assert.match(cloud.at(-1), /can be wrong.*isn’t medical, legal or clinical advice/)
assert.match(aboutAnswer({ model: 'GPT-4o mini' }, { by: 'unavailable' })[1], /couldn’t run this time/)
assert.match(aboutAnswer({}, { by: 'rules' })[1], /your own model and nowhere else/)
const device = aboutAnswer({ agent: 'Study buddy', onDevice: true }, { by: 'rules', care: true })
assert.match(device[0], /for your agent “Study buddy”/)
assert.match(device[1], /ran on your own device/)
assert.ok(!aboutAnswer({}, null).some((l) => /checked for safety/.test(l)), 'never says checked when it wasn’t')

// The team's counts (STEP 101): by what was done, what was found, where, and by week (Monday-first, newest first).
const ev = (at, action, category, extra = {}) => ({ created_at: at, surface: 'assistant', direction: 'person', severity: 1,
  category, action, checked_by: 'openai', hidden: null, ...extra })
const s = summarise([
  ev('2026-11-09T14:00:00Z', 'hide', 'personal_info', { hidden: ['phone', 'email'] }),
  ev('2026-11-08T09:00:00Z', 'care', 'care', { checked_by: 'rules', surface: 'agent' }),
  ev('2026-11-03T09:00:00Z', 'steer', 'exploitation'),
  ev('2026-11-02T23:00:00Z', 'rewritten', 'medical_advice', { direction: 'reply' }),
  ev('2026-11-02T22:00:00Z', 'allow', 'none', { checked_by: 'unavailable' }),
  ev('2026-08-01T00:00:00Z', 'care', 'care'),
], new Date('2026-11-09T15:00:00Z'), 3)
assert.equal(s.total, 6)
assert.deepEqual(s.byAction, { hide: 1, care: 2, steer: 1, rewritten: 1, unchecked: 1 })
assert.equal(s.byCategory.none, undefined, '“nothing” isn’t a finding')
assert.deepEqual(s.bySurface, { assistant: 5, agent: 1 })
assert.deepEqual(s.hidden, { phone: 1, email: 1 })
assert.deepEqual(s.weeks.map((w) => w.start), ['2026-11-09', '2026-11-02', '2026-10-26'])
assert.deepEqual(s.weeks[0], { start: '2026-11-09', care: 0, steer: 0, hide: 1, answers: 0, unchecked: 0 }, 'Monday 9 November')
assert.deepEqual(s.weeks[1], { start: '2026-11-02', care: 1, steer: 1, hide: 0, answers: 1, unchecked: 1 }, 'Sunday the 8th is in the week of the 2nd')

console.log('aiSafety: ok')
