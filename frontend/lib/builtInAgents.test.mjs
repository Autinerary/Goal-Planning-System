// node --test lib/builtInAgents.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('./built-in-agents.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('./builtInAgents.ts', import.meta.url), 'utf8')
// promptParts, without TypeScript.
const body = source.slice(source.indexOf('export function promptParts'))
const promptParts = new Function(`${body.replace(/^export /, '').replace(/: \{ text: string; filled: boolean \}\[\]/g, '').replace(/\(text: string\)/, '(text)').replace(/match\.index!/g, 'match.index')}; return promptParts`)()

test('the six, numbered in the order the plan runs them', () => {
  assert.deepEqual(data.agents.map((a) => a.number), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(data.agents.map((a) => a.id),
    ['path_planning', 'pattern_recognition', 'tool_recommendation', 'reflection_analysis', 'adaptation', 'calendar_optimization'])
  for (const a of data.agents) assert.ok(a.prompts.length > 0 || a.note, a.id)
})

test('the parts filled in for each plan are marked', () => {
  const parts = promptParts('Each has ‹per area› names. [When the plan is for someone else:] For ‹who›.')
  assert.deepEqual(parts.filter((p) => p.filled).map((p) => p.text), ['‹per area›', '[When the plan is for someone else:]', '‹who›'])
  assert.equal(parts.map((p) => p.text).join(''), 'Each has ‹per area› names. [When the plan is for someone else:] For ‹who›.')
  // Brackets in a JSON example aren't parts.
  assert.equal(promptParts('Return JSON: {"strategies": []}').filter((p) => p.filled).length, 0)
})
