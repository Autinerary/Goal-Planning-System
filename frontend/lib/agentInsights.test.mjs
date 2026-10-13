// What an agent's insight banner says (lib/agentInsights.ts). Plain JS so the
// app's type check leaves it alone. Run from frontend/:
//   node --experimental-strip-types lib/agentInsights.test.mjs
import assert from 'node:assert/strict'
import { insightMessage } from './agentInsights.ts'

// The explanation comes first, as before.
assert.equal(insightMessage('calendar_optimization', { explanation: 'A gentle week.', confidence: 0.75 }), 'A gentle week.')

// Calendar Optimization's confidence is never shown: not the old stored 0.75,
// not the null new schedules store.
assert.equal(insightMessage('calendar_optimization', { confidence: 0.75 }), null)
assert.equal(insightMessage('calendar_optimization', { confidence: null }), null)
assert.equal(insightMessage('calendar_optimization', { explanation: '  ', confidence: 0.75 }), null)

// Other agents keep their fallback, unchanged.
assert.equal(insightMessage('tool_recommendation', { confidence: 0.45 }), 'Confidence: 45%')
assert.equal(insightMessage('path_planning', { summary: 'Sixteen steps.' }), 'Sixteen steps.')
assert.equal(insightMessage('pattern_recognition', null), null)

console.log('agentInsights: ok')
