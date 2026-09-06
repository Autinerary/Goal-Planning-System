// Weather forecast for the calendar's rain-day warning (Odosa).
//
// Open-Meteo rather than a commercial provider: no API key, no signup, no
// billing account for anyone to configure — it just works the moment this
// ships. Real forecast data, never a guess.

export interface DayForecast {
  /** ISO date, e.g. 2026-09-08 */
  date: string
  /** 'Monday' etc — the calendar's tasks are organised by weekday name. */
  weekday: string
  rainProbabilityPct: number
  isRainy: boolean
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** A day counts as "rainy" above this — Open-Meteo's own probability field. */
const RAIN_THRESHOLD = 50

export async function fetchForecast(lat: number, lon: number): Promise<DayForecast[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_probability_max&forecast_days=7&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`)
  const json = await res.json()
  const dates: string[] = json?.daily?.time || []
  const probs: number[] = json?.daily?.precipitation_probability_max || []
  return dates.map((date, i) => {
    const pct = Number(probs[i] ?? 0)
    const [y, m, d] = date.split('-').map(Number)
    const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
    return { date, weekday, rainProbabilityPct: pct, isRainy: pct >= RAIN_THRESHOLD }
  })
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
