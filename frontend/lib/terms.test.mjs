// Run from frontend/: node --experimental-strip-types lib/terms.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TERMS } from './terms.ts'

const help = readFileSync(new URL('../app/help/page.tsx', import.meta.url), 'utf8')
for (const [id, t] of Object.entries(TERMS)) {
  assert.ok(t.short.length < 260, `${id}: one or two sentences`)
  assert.ok(t.question.endsWith('?'), `${id}: asked as a question`)
  assert.ok(!/\b(suffer|deficit|disorder)\b/i.test(t.short), `${id}: plain, never clinical (docs/voice.md)`)
  // The glossary entry it points to exists.
  const anchor = t.glossary.split('#')[1]
  assert.ok(help.includes(`id: '${anchor}'`), `${id}: /help has #${anchor}`)
}
// Each says what the word means using the app's other words consistently.
assert.match(TERMS.path.short, /milestones/)
assert.match(TERMS.milestone.short, /tasks/)
assert.match(TERMS.norms.short, /optional/)
console.log('terms: ok')
