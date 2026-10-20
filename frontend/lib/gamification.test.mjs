// Run from frontend/: node --experimental-strip-types lib/gamification.test.mjs
import assert from 'node:assert/strict'
import { slotCount, slotLabel, SPIRIT_MODES, animalForDay, normalizeGamification } from './gamification.ts'

// One choice decides how many: one, two or seven, always.
assert.deepEqual(SPIRIT_MODES.map((m) => [m.id, slotCount(m.id)]), [['general', 1], ['fastSlow', 2], ['weekly', 7]])
// One animal is just "your spirit animal", never a fast day animal.
assert.equal(slotLabel('general', 0), 'Choose your spirit animal')
// Fast and slow are always 1/2 and 2/2; the week always 1/7 to 7/7.
assert.equal(slotLabel('fastSlow', 0), 'Choose your fast day animal (1/2)')
assert.equal(slotLabel('fastSlow', 1), 'Choose your slow day animal (2/2)')
assert.equal(slotLabel('weekly', 0), 'Choose your Monday animal (1/7)')
assert.equal(slotLabel('weekly', 6), 'Choose your Sunday animal (7/7)')

// Which animal shows on a day, from what was chosen.
const prefs = normalizeGamification({ mode: 'fastSlow', animals: [{ type: 'fox', color: 'orange' }, { type: 'turtle', color: 'green' }] })
assert.equal(animalForDay(prefs, new Date(2026, 9, 19), 'slow')?.type, 'turtle')
assert.equal(animalForDay(prefs, new Date(2026, 9, 19), 'fast')?.type, 'fox')
assert.equal(animalForDay({ ...prefs, mode: 'general' }, new Date(2026, 9, 19), 'unknown')?.type, 'fox')
console.log('gamification: ok')

// Energy from the weather: off unless asked for, and only a real true.
assert.equal(normalizeGamification({}).energyFromWeather, false)
assert.equal(normalizeGamification({ energyFromWeather: 'yes' }).energyFromWeather, false)
assert.equal(normalizeGamification({ energyFromWeather: true }).energyFromWeather, true)
console.log('gamification (weather): ok')
