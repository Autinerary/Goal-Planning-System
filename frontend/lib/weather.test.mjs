// Run from frontend/: node --experimental-strip-types lib/weather.test.mjs
import assert from 'node:assert/strict'
import { classifyDay, forecastFrom, roundCoord } from './weather.ts'

// About 10 km: what Open-Meteo is sent.
assert.equal(roundCoord(43.65348), 43.7)
assert.equal(roundCoord(-79.38393), -79.4)

// Rain, snow, fog and storms from the weather code.
assert.deepEqual(classifyDay(63, 90, 100), { kind: 'rainy', label: 'Rain' })
assert.deepEqual(classifyDay(53, 40, 100), { kind: 'rainy', label: 'Drizzle' })
assert.deepEqual(classifyDay(81, 70, 80), { kind: 'rainy', label: 'Showers' })
assert.deepEqual(classifyDay(95, 80, 90), { kind: 'rainy', label: 'Thunderstorms' })
assert.deepEqual(classifyDay(73, 60, 100), { kind: 'snowy', label: 'Snow' })
assert.deepEqual(classifyDay(45, 0, 100), { kind: 'grey', label: 'Fog' })
// A high chance of rain is a rain day, whatever the code says.
assert.equal(classifyDay(2, 55, 40).kind, 'rainy')
// Otherwise the clouds decide: a day can say "overcast" (3) and average 9% cloud.
assert.deepEqual(classifyDay(3, 0, 9), { kind: 'sunny', label: 'Sunny' })
assert.deepEqual(classifyDay(0, 0, 30), { kind: 'sunny', label: 'Mostly sunny' })
assert.deepEqual(classifyDay(2, 10, 60), { kind: 'grey', label: 'Mostly cloudy' })
assert.deepEqual(classifyDay(3, 0, 93), { kind: 'grey', label: 'Cloudy' })

// Open-Meteo's daily answer, as days (the real shape, 20 October 2026, Toronto).
const days = forecastFrom({ daily: {
  time: ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-25'],
  weather_code: [0, 2, 61, 3],
  precipitation_probability_max: [0, 0, 85, 1],
  cloud_cover_mean: [1, 10, 100, 93],
} })
assert.deepEqual(days.map((d) => [d.weekday, d.kind, d.isRainy, d.rainProbabilityPct]), [
  ['Tuesday', 'sunny', false, 0], ['Wednesday', 'sunny', false, 0], ['Thursday', 'rainy', true, 85], ['Sunday', 'grey', false, 1],
])
// A day with nothing usable is left out, not guessed.
assert.equal(forecastFrom({ daily: { time: ['2026-10-20'], weather_code: [null], precipitation_probability_max: [null] } }).length, 0)
console.log('weather: ok')
