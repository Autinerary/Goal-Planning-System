// The colour theme and colour strength (lib/preferences.ts; the team's
// planning note, October 2026). Plain JS so the app's type check leaves it
// alone. Run from frontend/:
//   node --experimental-strip-types lib/preferences.test.mjs
import assert from 'node:assert/strict'
import { COLOUR_THEMES, COLOUR_STRENGTHS, DEFAULT_LAYOUT, colourStrengthOf, themeOf } from './preferences.ts'

// Earthy first, and the default; Classic, the original colours, is still there.
assert.deepEqual(COLOUR_THEMES.map((t) => t.id), ['earthy', 'ocean', 'sand', 'classic'])
assert.equal(DEFAULT_LAYOUT.theme, 'earthy')
assert.equal(themeOf(undefined), 'earthy')
assert.equal(themeOf({}), 'earthy')
assert.equal(themeOf({ theme: 'sand' }), 'sand')
// A theme that does not exist (an old or hand-edited value) is Earthy.
assert.equal(themeOf({ theme: 'neon' }), 'earthy')

// Five strengths, softest to brightest, usual in the middle (the slider).
assert.deepEqual(COLOUR_STRENGTHS.map((c) => c.id), ['softest', 'soft', 'usual', 'bright', 'brightest'])
assert.equal(COLOUR_STRENGTHS[2].id, 'usual')
assert.equal(colourStrengthOf(undefined), 'usual')
assert.equal(colourStrengthOf({}), 'usual')
// Soft colours, saved before colour strength, is Softer.
assert.equal(colourStrengthOf({ softColors: true }), 'soft')
// Colour strength wins once it is set, even back to usual.
assert.equal(colourStrengthOf({ softColors: true, colorStrength: 'usual' }), 'usual')
assert.equal(colourStrengthOf({ colorStrength: 'brightest' }), 'brightest')
assert.equal(colourStrengthOf({ colorStrength: 'loud' }), 'usual')

console.log('preferences: ok')
