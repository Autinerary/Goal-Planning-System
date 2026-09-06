'use client'

import { useEffect, useState } from 'react'
import { CloudRain, Sun } from 'lucide-react'
import { fetchForecast, getBrowserLocation, suggestClearerDay, type DayForecast } from '@/lib/weather'

const PREF_KEY = 'autinerary_weather_prefs'

interface WeatherPrefs {
  /** Which kind of day the user actually prefers to work on. */
  preference: 'rain' | 'sunny' | 'no_preference'
  /** If true, a rainy day on the preferred-against side auto-suggests a swap. */
  autoMatch: boolean
}

function loadPrefs(): WeatherPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (raw) return { preference: 'no_preference', autoMatch: false, ...JSON.parse(raw) }
  } catch {}
  return { preference: 'no_preference', autoMatch: false }
}

/**
 * "Immediately tell when a rain day is coming & offer to switch day to that"
 * (Odosa) — plus the sunny/rain preference and auto-match toggle.
 *
 * Real forecast (Open-Meteo, see lib/weather.ts), real device location with
 * consent. Says nothing if location is denied or a fetch fails — a missing
 * forecast is not a reason to show a fake one.
 *
 * The calendar organises tasks by weekday NAME on a repeating template
 * (see app/calendar/page.tsx), not by real calendar dates, so this checks
 * the WEEKDAY's upcoming occurrence within the next 7 days rather than
 * "every Tuesday forever" — the honest scope of what a 7-day forecast can
 * actually tell you.
 */
export default function RainDayBanner({
  weekday,
  onSwitchDay,
  compact = false,
}: {
  weekday: string
  onSwitchDay?: (toWeekday: string) => void
  /** Suppress the preferences panel — for embedding in a narrow grid cell
   *  where showing it on every column would be clutter, not seven times. */
  compact?: boolean
}) {
  const [forecast, setForecast] = useState<DayForecast[]>([])
  const [prefs, setPrefs] = useState<WeatherPrefs>(() => loadPrefs())
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let cancelled = false
    getBrowserLocation()
      .then(({ lat, lon }) => fetchForecast(lat, lon))
      .then((f) => { if (!cancelled) setForecast(f) })
      .catch(() => { if (!cancelled) setDenied(true) })
    return () => { cancelled = true }
  }, [])

  const savePrefs = (next: WeatherPrefs) => {
    setPrefs(next)
    try { localStorage.setItem(PREF_KEY, JSON.stringify(next)) } catch {}
  }

  const thisDay = forecast.find((d) => d.weekday === weekday)
  const suggestion = thisDay?.isRainy ? suggestClearerDay(forecast, thisDay.date) : null

  return (
    <div className="space-y-2">
      {thisDay?.isRainy && (
        <div className="flex items-start gap-3 p-3 rounded-xl border-2 border-sky-300 bg-sky-50">
          <CloudRain className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-sky-900">
              Rain expected {new Date(thisDay.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              {' '}({thisDay.rainProbabilityPct}% chance)
            </p>
            {suggestion && onSwitchDay && (
              <button
                onClick={() => onSwitchDay(suggestion.weekday)}
                className="mt-1 text-xs font-bold text-sky-700 underline hover:text-sky-900"
              >
                Move this to {suggestion.weekday} instead ({suggestion.rainProbabilityPct}% chance)
              </button>
            )}
          </div>
        </div>
      )}

      {!denied && !compact && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none">Weather preferences</summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(['no_preference', 'sunny', 'rain'] as const).map((p) => (
              <button
                key={p}
                onClick={() => savePrefs({ ...prefs, preference: p })}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                  prefs.preference === p ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'
                }`}
              >
                {p === 'no_preference' ? 'No preference' : p === 'sunny' ? '☀️ Prefer sunny days' : '🌧️ Prefer rainy days'}
              </button>
            ))}
            <label className="flex items-center gap-1.5 ml-1">
              <input
                type="checkbox"
                checked={prefs.autoMatch}
                onChange={(e) => savePrefs({ ...prefs, autoMatch: e.target.checked })}
              />
              Auto-switch days to match
            </label>
          </div>
        </details>
      )}
    </div>
  )
}
