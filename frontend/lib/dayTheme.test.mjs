// Run from frontend/: node --experimental-strip-types lib/dayTheme.test.mjs
import assert from 'node:assert/strict'
import { themeForDay, setDayTheme, energyForKind, paceForKind, skyForTheme, recordEnergy, dateKey } from './dayTheme.ts'

const rainy = { date: '2026-10-22', weekday: 'Thursday', rainProbabilityPct: 85, isRainy: true, code: 61, cloudPct: 100, kind: 'rainy', label: 'Rain' }
// A choice wins; otherwise the forecast decides; rain is a grey day.
assert.deepEqual(themeForDay({ '2026-10-22': 'sunny' }, '2026-10-22', rainy), { theme: 'sunny', from: 'chosen' })
assert.deepEqual(themeForDay({}, '2026-10-22', rainy), { theme: 'grey', from: 'forecast' })
assert.deepEqual(themeForDay(undefined, '2026-10-22', null), { theme: null, from: null })

// Choosing keeps 60 days back and 30 ahead, and clearing removes it.
const today = new Date(2026, 9, 20)
let map = setDayTheme({ '2026-01-01': 'grey', '2026-10-19': 'sunny' }, '2026-10-22', 'grey', today)
assert.deepEqual(map, { '2026-10-19': 'sunny', '2026-10-22': 'grey' })
map = setDayTheme(map, '2026-10-22', null, today)
assert.deepEqual(map, { '2026-10-19': 'sunny' })

// Energy and animals from the weather: sunny high and fast, grey balanced, rain or snow low and slow.
assert.deepEqual(['sunny', 'grey', 'rainy', 'snowy'].map(energyForKind), ['best', 'average', 'worst', 'worst'])
assert.deepEqual(['sunny', 'grey', 'rainy', 'snowy'].map(paceForKind), ['fast', 'unknown', 'slow', 'slow'])
// The sky on a themed day.
assert.deepEqual(skyForTheme('sunny'), { light: 'bright', clouds: true, cloudColour: 100 })
assert.deepEqual(skyForTheme('grey'), { light: 'cloudy', clouds: true, cloudColour: 0 })

// The energy chosen each day, half a year of it.
const e = recordEnergy({ '2025-01-01': 'best', '2026-10-19': 'worst' }, 'average', today)
assert.deepEqual(e, { '2026-10-19': 'worst', '2026-10-20': 'average' })
assert.equal(dateKey(today), '2026-10-20')
console.log('dayTheme: ok')
