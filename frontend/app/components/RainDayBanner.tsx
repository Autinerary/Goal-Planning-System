'use client'

import { useEffect, useRef, useState } from 'react'
import { CloudRain } from 'lucide-react'
import { fetchForecast, getBrowserLocation, suggestPreferredDay, type DayForecast } from '@/lib/weather'

const PREF_KEY = 'autinerary_weather_prefs'
let automaticMoveInFlight = false

interface WeatherPrefs {
  enabled?: boolean
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
  onSwitchDay?: (toWeekday: string) => Promise<boolean>
  /** Suppress the preferences panel — for embedding in a narrow grid cell
   *  where showing it on every column would be clutter, not seven times. */
  compact?: boolean
}) {
  const [forecast, setForecast] = useState<DayForecast[]>([])
  const [prefs, setPrefs] = useState<WeatherPrefs>(() => loadPrefs())
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const automaticMoves = useRef(new Set<string>())

  useEffect(() => {
    const sync = () => setPrefs(loadPrefs())
    window.addEventListener('autinerary:weather', sync)
    return () => window.removeEventListener('autinerary:weather', sync)
  }, [])

  useEffect(() => {
    if (!prefs.enabled) { setForecast([]); return }
    let cancelled = false
    setBusy(true)
    setDenied(false)
    getBrowserLocation()
      .then(({ lat, lon }) => fetchForecast(lat, lon))
      .then((f) => { if (!cancelled) setForecast(f) })
      .catch(() => { if (!cancelled) setDenied(true) })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [prefs.enabled])

  const savePrefs = (next: WeatherPrefs) => {
    setPrefs(next)
    try { localStorage.setItem(PREF_KEY, JSON.stringify(next)) } catch {}
    window.dispatchEvent(new CustomEvent('autinerary:weather'))
  }

  const thisDay = forecast.find((d) => d.weekday === weekday)
  const suggestion = thisDay ? suggestPreferredDay(forecast, thisDay, prefs.preference) : null

  useEffect(() => {
    if (!prefs.autoMatch || !thisDay || !suggestion || !onSwitchDay || automaticMoveInFlight) return
    const key = `${thisDay.date}:${suggestion.date}`
    if (automaticMoves.current.has(key)) return
    automaticMoves.current.add(key)
    automaticMoveInFlight = true
    void onSwitchDay(suggestion.weekday).finally(() => { automaticMoveInFlight = false })
  }, [prefs.autoMatch, thisDay, suggestion, onSwitchDay])

  return (
    <div className="space-y-2">
      {!prefs.enabled && <div className="text-xs"><p className="mb-1 text-slate-600">Enabling weather shares your location with Open-Meteo.</p><button type="button" onClick={() => savePrefs({ ...prefs, enabled: true })} className="underline">Enable local forecast</button></div>}
      {busy && <p role="status" className="text-xs">Loading forecast...</p>}
      {denied && <p role="status" className="text-xs">Forecast unavailable. Check location permission or turn weather off and on to retry.</p>}
      {thisDay?.isRainy && (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-sky-300 bg-sky-50">
          <CloudRain className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-sky-900">
              Rain expected {new Date(`${thisDay.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              {' '}({thisDay.rainProbabilityPct}% chance)
            </p>
          </div>
        </div>
      )}

      {suggestion && onSwitchDay && <button type="button" onClick={() => onSwitchDay(suggestion.weekday)} className="text-xs font-medium text-sky-800 underline">Move undated added tasks to {suggestion.weekday} ({suggestion.rainProbabilityPct}% rain chance)</button>}
      {prefs.enabled && (
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
              Auto-move undated added tasks to match
            </label>
            <button type="button" onClick={() => savePrefs({ ...prefs, enabled: false, autoMatch: false })} className="underline">Disable weather</button>
            <span>Open-Meteo receives your location to return a forecast.</span>
          </div>
        </details>
      )}
    </div>
  )
}
