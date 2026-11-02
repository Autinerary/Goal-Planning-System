// node --test lib/agentSetup.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The pure parts of lib/agentSetup.ts, without TypeScript.
const source = readFileSync(new URL('./agentSetup.ts', import.meta.url), 'utf8')
const js = source
  .replace(/^import type .*$/gm, '')
  .replace(/^export type [^\n]*$/gm, '')
  .replace(/export /g, '')
  .replace(/: Storage \| null = /g, ' = ')
  .replace(/\): SavedSetup \| null \{/g, ') {')
  .replace(/\(seventh: SetupSeventh\): Agent \{/g, '(seventh) {')
  .replace(/\(goal: SetupGoal\): string \{/g, '(goal) {')
  .replace(/\(asked: string, result: SetupResult, storage/g, '(asked, result, storage')
  .replace(/const saved: SavedSetup = /g, 'const saved = ')
  .replace(/ as SavedSetup/g, '')
const lib = new Function(`${js}; return { loadSetup, saveSetup, draftAgent, planLink, SETUP_KEY }`)()

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }

test('what the six will do for what they asked is kept, and read back', () => {
  const store = memory()
  assert.equal(lib.loadSetup(store), null)
  lib.saveSetup('I need to finish my diploma', { goal: { text: 'Finish my college diploma', area: 'education' }, forYou: { adaptation: 'Makes steps smaller.' }, seventh: null }, store)
  const back = lib.loadSetup(store)
  assert.equal(back.asked, 'I need to finish my diploma')
  assert.equal(back.forYou.adaptation, 'Makes steps smaller.')
  store.setItem(lib.SETUP_KEY, '{not json')
  assert.equal(lib.loadSetup(store), null)
})

test('the drafted 7th opens as a new agent on the device', () => {
  const agent = lib.draftAgent({ name: 'One thing at a time', purpose: 'Says the next small thing.', instructions: 'Look at one step.', lens: ['autism'], sees: ['plan'] })
  assert.equal(agent.id, '')
  assert.equal(agent.runsOn, 'device')
  assert.deepEqual(agent.sees, ['plan'])
  assert.equal(agent.from, null)
})

test('making a plan starts setup with that goal', () => {
  assert.equal(lib.planLink({ text: 'Finish my college diploma', area: 'education' }), '/onboarding?goal=Finish+my+college+diploma&area=education')
})
