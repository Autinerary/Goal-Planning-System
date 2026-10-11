// Same example as backend/tests/test_path_privacy.py.
// Plain JS so the app's type check leaves it alone; Node strips the types from
// the module it imports. Run from frontend/:
//   node --experimental-strip-types lib/pathPrivacy.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { withoutOtherPeople } from './pathPrivacy.ts'

const example = JSON.parse(
  readFileSync(new URL('../../backend/tests/fixtures/plan_with_other_people.json', import.meta.url), 'utf8')
)
const stored = structuredClone(example.stored)
assert.deepEqual(withoutOtherPeople(stored), example.returned, 'other people removed and counted')
assert.deepEqual(stored, example.stored, 'the stored plan is not changed')
for (const value of [null, [], 'x', { id: 'p' }, { agentResponses: null }]) {
  assert.equal(withoutOtherPeople(value), value, 'not a plan: passes through')
}
const clean = withoutOtherPeople(example.stored)
assert.equal(withoutOtherPeople(clean), clean, 'a clean plan is returned as is')
console.log('pathPrivacy: 4 checks passed')
