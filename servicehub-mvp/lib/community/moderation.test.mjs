// Run from servicehub-mvp/: node --experimental-strip-types lib/community/moderation.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { moderateFields, moderateText } from './moderation.ts'

// Swear words are bleeped, however they are spelled, and the post still reads.
for (const [text, want] of [
  ['What the fuck.', 'What the (bleep).'],
  ['f*ck this', '(bleep) this'],
  ['sh1t happens', '(bleep) happens'],
  ['f.u.c.k', '(bleep)'],
  ['(fuck),', '((bleep)),'],
  ['Bullshit!', '(bleep)!'],
  ['fuck!!', '(bleep)!!'],
  ['**fuck**', '**(bleep)**'],
  ["fuckin' hard", "(bleep)' hard"],
  ['a mother-fucker', 'a (bleep)'],
]) {
  const r = moderateText(text)
  assert.equal(r.text, want, text)
  assert.ok(r.bleeped >= 1, text)
  assert.equal(r.slur, false, text)
}

// Words that only look like one are left alone.
for (const text of ['Scunthorpe', 'Dickens', 'assistant', 'Shitake mushrooms', 'cocktail class', 'assessment', 'Hello!', 'the *best* day', 'flame retardant']) {
  const r = moderateText(text)
  assert.equal(r.text, text, text)
  assert.equal(r.bleeped, 0, text)
  assert.equal(r.slur, false, text)
}

// Slurs are refused. The list is kept encoded, so this test decodes one from
// the module's own source rather than writing it out.
const source = readFileSync(new URL('./moderation.ts', import.meta.url), 'utf8')
const encoded = /Buffer\.from\('([A-Za-z0-9+/=]+)', 'base64'\)/.exec(source)?.[1]
assert.ok(encoded, 'the slur list is in moderation.ts')
const slurs = Buffer.from(encoded, 'base64').toString('utf8').split('\n')
assert.ok(slurs.length > 10)
for (const s of [slurs[0], slurs[slurs.length - 1]]) {
  assert.equal(moderateText(`you ${s}`).slur, true)
  assert.equal(moderateText(`you ${s.toUpperCase()}!`).slur, true)
  assert.equal(moderateText(`you ${s}s.`).slur, true)
  assert.equal(moderateText(`you ${s.replace(/i/g, '1').replace(/o/g, '0')}`).slur, true)
}

// Several fields at once: each is bleeped, and the counts add up.
const f = moderateFields({ title: 'Oh shit', body: 'fuck and shit', note: null })
assert.deepEqual(f.fields, { title: 'Oh (bleep)', body: '(bleep) and (bleep)', note: null })
assert.equal(f.bleeped, 3)
assert.equal(f.slur, false)

console.log('moderation: ok')
