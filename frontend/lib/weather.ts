// Weather forecast for the Calendar (Odosa): the kind of day each day will be
// (sunny, grey, rain or snow), a rain day coming, and the energy level to
// match, for people who ask for it.
//
// Open-Meteo rather than a commercial provider: no API key, no signup, no
// billing account for anyone to configure. Real forecast data, never a guess.
// Its data is CC BY 4.0, so the forecast is credited where it shows. It gets
// an approximate location only: the browser's position rounded to a tenth of
// a degree (about 10 km), plenty for a day's weather.

export type DayKind = 'sunny' | 'grey' | 'rainy' | 'snowy'

export interface DayForecast {
  /** ISO date, e.g. 2026-09-08 */
  date: string
  /** 'Monday' etc — the calendar's tasks are organised by weekday name. */
  weekday: string
  rainProbabilityPct: number
  /** Rain (or drizzle, showers, a storm) is expected: a rain day. */
  isRainy: boolean
  /** The day's WMO weather code (Open-Meteo's most significant one). */
  code: number | null
  /** Mean cloud cover, 0 to 100. */
  cloudPct: number | null
  kind: DayKind
  /** In words: Sunny, Mostly sunny, Mostly cloudy, Cloudy, Fog, Drizzle, Rain… */
  label: string
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** A day counts as rainy at this chance of rain or more — Open-Meteo's own probability field. */
const RAIN_THRESHOLD = 50

/** About 10 km: enough for a forecast, not enough to find someone. */
export const roundCoord = (n: number) => Math.round(n * 10) / 10

const num = (v: unknown): number | null => (v == null || !Number.isFinite(Number(v)) ? null : Number(v))

/**
 * What kind of day it will be. Rain, snow, fog and storms come from the
 * weather code; otherwise the clouds decide, as the day's code is its most
 * significant hour (a day can say "overcast" and average 9% cloud).
 */
export function classifyDay(code: number | null, rainPct: number | null, cloudPct: number | null): { kind: DayKind; label: string } {
  const c = code ?? -1
  if (c >= 95) return { kind: 'rainy', label: 'Thunderstorms' }
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { kind: 'snowy', label: 'Snow' }
  if (c >= 80 && c <= 82) return { kind: 'rainy', label: 'Showers' }
  if (c >= 61 && c <= 67) return { kind: 'rainy', label: 'Rain' }
  if (c >= 51 && c <= 57) return { kind: 'rainy', label: 'Drizzle' }
  if ((rainPct ?? 0) >= RAIN_THRESHOLD) return { kind: 'rainy', label: 'Rain likely' }
  if (c === 45 || c === 48) return { kind: 'grey', label: 'Fog' }
  const cloud = cloudPct ?? (c === 3 ? 90 : c === 2 ? 50 : c >= 0 ? 10 : 50)
  if (cloud >= 80) return { kind: 'grey', label: 'Cloudy' }
  if (cloud >= 50) return { kind: 'grey', label: 'Mostly cloudy' }
  if (cloud >= 20) return { kind: 'sunny', label: 'Mostly sunny' }
  return { kind: 'sunny', label: 'Sunny' }
}

export const FORECAST_CREDIT = 'Weather data by Open-Meteo.com'

export async function fetchForecast(lat: number, lon: number): Promise<DayForecast[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${roundCoord(lat)}&longitude=${roundCoord(lon)}` +
    `&daily=weather_code,precipitation_probability_max,cloud_cover_mean&forecast_days=7&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`)
  const json = await res.json()
  return forecastFrom(json)
}

/** Open-Meteo's daily answer as forecast days (separate so it can be tested). */
export function forecastFrom(json: any): DayForecast[] {
  const dates: string[] = json?.daily?.time || []
  const probs: unknown[] = json?.daily?.precipitation_probability_max || []
  const codes: unknown[] = json?.daily?.weather_code || []
  const clouds: unknown[] = json?.daily?.cloud_cover_mean || []
  return dates.flatMap((date, i) => {
    const pct = num(probs[i])
    const code = num(codes[i])
    const cloud = num(clouds[i])
    if (pct == null && code == null) return []
    const [y, m, d] = date.split('-').map(Number)
    const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
    const { kind, label } = classifyDay(code, pct, cloud)
    return [{ date, weekday, rainProbabilityPct: pct ?? 0, isRainy: kind === 'rainy', code, cloudPct: cloud, kind, label }]
  })
}

export function suggestPreferredDay(forecast: DayForecast[], current: DayForecast, preference: 'rain' | 'sunny' | 'no_preference'): DayForecast | null {
  if (preference === 'no_preference' || current.isRainy === (preference === 'rain')) return null
  const candidates = forecast.filter(day => day.date > current.date && day.isRainy === (preference === 'rain'))
  return candidates.sort((first, second) => preference === 'rain' ? second.rainProbabilityPct - first.rainProbabilityPct : first.rainProbabilityPct - second.rainProbabilityPct)[0] || null
}

/** Best rain-free day in the SAME set as the given rainy one — for the
 *  "switch to that day" suggestion. Excludes the rainy day itself. */
export function suggestClearerDay(forecast: DayForecast[], rainyDate: string): DayForecast | null {
  const candidates = forecast.filter((d) => d.date !== rainyDate)
  if (candidates.length === 0) return null
  return candidates.reduce((best, d) => (d.rainProbabilityPct < best.rainProbabilityPct ? d : best))
}

/** Browser geolocation, the honest source — real device position, with
 *  consent. No fallback to a guessed location; callers should just not show
 *  the weather feature if this rejects. */
export function getBrowserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not available'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 8000, maximumAge: 30 * 60 * 1000 }
    )
  })
}
