// The colour theme and colour strength (lib/preferences.ts; the team's
// planning note, October 2026). Plain JS so the app's type check leaves it
// alone. Run from frontend/:
//   node --experimental-strip-types lib/preferences.test.mjs
import assert from 'node:assert/strict'
import { COLOUR_THEMES, COLOUR_STRENGTHS, DEFAULT_LAYOUT, colourStrengthOf, themeOf } from './preferences.ts'

// Earthy first, and the default; Warm and Cool (the products round's
// planning note: "Warm orange (warm mode) / soft lilac (cool mode)"); Classic,
// the original colours, is still there.
assert.deepEqual(COLOUR_THEMES.map((t) => t.id), ['earthy', 'ocean', 'sand', 'warm', 'cool', 'bakery', 'classic'])
assert.equal(COLOUR_THEMES.find((t) => t.id === 'warm').hint, 'Warm orange')
assert.equal(COLOUR_THEMES.find((t) => t.id === 'cool').hint, 'Soft lilac')
assert.equal(COLOUR_THEMES.find((t) => t.id === 'bakery').hint, 'Golden, light and dark brown')
assert.equal(DEFAULT_LAYOUT.theme, 'earthy')
assert.equal(themeOf(undefined), 'earthy')
assert.equal(themeOf({}), 'earthy')
assert.equal(themeOf({ theme: 'sand' }), 'sand')
assert.equal(themeOf({ theme: 'warm' }), 'warm')
assert.equal(themeOf({ theme: 'cool' }), 'cool')
assert.equal(themeOf({ theme: 'bakery' }), 'bakery')
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

// How you see the screen: what it turns on (and never off).
{
  const { visionSettings } = await import('./preferences.ts')
  const assertMod = (await import('node:assert/strict')).default
  assertMod.deepEqual(visionSettings('blind', false), { vision: 'blind', screenReader: false, voiceNavigation: true, readAloud: true, spokenDescriptions: true })
  // With a screen reader, it already speaks: no spoken descriptions on top.
  assertMod.deepEqual(visionSettings('blind', true), { vision: 'blind', screenReader: true, voiceNavigation: true, readAloud: true })
  assertMod.deepEqual(visionSettings('low', false).spokenDescriptions, true)
  // No answer changes nothing else.
  assertMod.deepEqual(visionSettings('', false), { vision: '', screenReader: false })
  console.log('preferences vision: ok')
}
