// One life area first (lib/lifeAreas.ts, Riipen Labs Group 20). Run from frontend/:
//   node --experimental-strip-types lib/lifeAreas.test.mjs
import assert from 'node:assert/strict'
import { lifeAreaView, visibleMilestones, areaList, areaOf } from './lifeAreas.ts'

const plan = ['education', 'education', 'workplace', 'career', 'relationships', 'health']
  .map((d, i) => ({ id: `m${i}`, dimension: d }))

// A new plan: its first area, and what comes next with how many steps.
const fresh = lifeAreaView(plan, new Set(), false)
assert.equal(fresh.all, false)
assert.equal(fresh.firstArea, 'education')
assert.deepEqual(fresh.hidden.map((h) => [h.area, h.count]), [['workplace', 2], ['relationships', 1], ['health', 1]])
assert.equal(visibleMilestones(plan, fresh).length, 2)
assert.equal(areaList(fresh.hidden), 'Workplace, Relationships and Health & Lifestyle')
assert.equal(areaOf({ id: 'x', category: 'career' }), 'workplace')

// Everything once a step is done, once asked for, or when there is one area or none.
assert.equal(lifeAreaView(plan, new Set(['m4']), false).all, true)
assert.equal(lifeAreaView(plan, new Set(), true).all, true)
assert.equal(lifeAreaView(plan.slice(0, 2), new Set(), false).all, true)
assert.equal(lifeAreaView([{ id: 'a' }, { id: 'b', dimension: 'health' }], new Set(), false).all, true)
assert.equal(visibleMilestones(plan, lifeAreaView(plan, new Set(), true)).length, plan.length)

// A supporting plan's own labels are kept (backend SUPPORT_DIMENSIONS).
const caring = [{ id: 'a', dimension: 'education', dimensionLabel: 'Learning & school' }, { id: 'b', dimension: 'workplace', dimensionLabel: 'School, work & daily life' }]
const v = lifeAreaView(caring, new Set(), false)
assert.equal(v.firstLabel, 'Learning & school')
assert.equal(v.hidden[0].label, 'School, work & daily life')

console.log('lifeAreas: all passed')
