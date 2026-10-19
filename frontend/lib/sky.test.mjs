// Run from frontend/: node --experimental-strip-types lib/sky.test.mjs
import assert from 'node:assert/strict'
import { DEFAULT_SKY, isDefaultSky, normalizeSky, skyLayers, needsDark } from './sky.ts'

// The usual sky draws nothing new.
assert.ok(isDefaultSky(normalizeSky(undefined)))
assert.ok(isDefaultSky(DEFAULT_SKY))
assert.ok(!isDefaultSky(normalizeSky({ clouds: false })))
assert.ok(!isDefaultSky(normalizeSky({ cloudColour: 0 })))
assert.equal(normalizeSky({ light: 'moonlight' }).light, 'day')
assert.equal(normalizeSky({ cloudColour: 250 }).cloudColour, 100)

// Night shows stars, in its true colours under dark mode.
const night = skyLayers(normalizeSky({ light: 'night' }), true)
assert.equal(night.light, 'night')
assert.equal(night.starsOpacity, 1)
assert.equal(night.keepColours, true)
assert.equal(skyLayers(normalizeSky({ light: 'night', stars: false }), true).starsOpacity, 0)
// Without dark mode, night is a cloudy day, so dark text stays readable.
assert.equal(skyLayers(normalizeSky({ light: 'night' }), false).light, 'cloudy')
assert.ok(needsDark('dusk') && !needsDark('bright'))
// No clouds; white and grey clouds.
assert.equal(skyLayers(normalizeSky({ clouds: false }), false).cloudOpacity, 0)
assert.match(skyLayers(normalizeSky({ cloudColour: 0 }), false).cloudFilter, /saturate\(0\.00\)/)
// Day levels keep the usual veil (the contrast the accessibility checks pass with).
assert.match(skyLayers(normalizeSky({ light: 'bright' }), false).veil, /0\.55/)
console.log('sky: ok')
