'use client'

import { CloudRain } from 'lucide-react'
import { DAY_THEMES, themeLabel, themeOfKind, type DayTheme } from '@/lib/dayTheme'
import { FORECAST_CREDIT, suggestPreferredDay, type DayForecast } from '@/lib/weather'
import type { ForecastStatus, WeatherPrefs } from './useForecast'

/**
 * The last layer of the Calendar's energy options (Odosa, October 2026):
 * "Grey Day" or "Sunny Day" for today, with the local forecast if someone
 * turns it on ("the Weather API that matches to someone's location if
 * allowed"), and "tell when a rain day is coming & offer to switch day to
 * that's theme". A theme applies once chosen; the forecast only says which
 * one it suggests. The forecast and its settings are kept on this device.
 */
export default function WeatherLayer({
  today,
  themes,
  onChoose,
  forecast,
  status,
  prefs,
  save,
  hasOwnTasksOn,
  onMoveOwnTasks,
}: {
  /** Today, YYYY-MM-DD. */
  today: string
  /** Themes chosen, by date. */
  themes: Record<string, DayTheme>
  onChoose: (date: string, theme: DayTheme | null) => void
  forecast: DayForecast[]
  status: ForecastStatus
  prefs: WeatherPrefs
  save: (next: WeatherPrefs) => void
  /** Whether they have tasks of their own repeating on a weekday (which can move). */
  hasOwnTasksOn?: (weekday: string) => boolean
  onMoveOwnTasks?: (fromWeekday: string, toWeekday: string) => void
}) {
  const todayForecast = forecast.find((d) => d.date === today) || null
  const suggested = todayForecast ? themeOfKind(todayForecast.kind) : null
  const chosen = themes[today] || null
  const rain = (prefs.rainAlerts !== false && status === 'ready') ? forecast.filter((d) => d.date >= today && d.isRainy) : []
  const nextRain = rain[0] || null
  const when = (d: DayForecast) => (d.date === today ? 'today' : `on ${new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}`)
  const dayName = (d: DayForecast) => (d.date === today ? 'Today' : d.weekday)
  const better = nextRain && prefs.preference !== 'no_preference' ? suggestPreferredDay(forecast, nextRain, prefs.preference) : null

  return (
    <div className="mb-6 rounded-2xl p-4 surface" data-weather-layer>
      <div role="group" aria-labelledby="day-kind-label" className="flex flex-wrap items-center gap-2">
        <span id="day-kind-label" className="mr-1 text-sm font-medium text-slate-800">What kind of day is today?</span>
        {DAY_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={chosen === t.id}
            onClick={() => onChoose(today, chosen === t.id ? null : t.id)}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
              chosen === t.id
                ? t.id === 'sunny'
                  ? 'border-amber-500 bg-amber-100 text-amber-950 shadow'
                  : 'border-slate-500 bg-slate-200 text-slate-900 shadow'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <span aria-hidden="true">{t.icon}</span> {t.label}
            {suggested === t.id && chosen !== t.id && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">The forecast</span>}
          </button>
        ))}
      </div>

      <div className="mt-2 text-sm text-slate-800">
        {status === 'off' && (
          <p>
            <button type="button" onClick={() => save({ ...prefs, enabled: true })} className="font-semibold text-indigo-800 underline underline-offset-2">
              Use the local forecast
            </button>{' '}
            to see what kind of days are coming. It uses this device’s approximate location (about 10 km), sent to Open-Meteo.
          </p>
        )}
        {status === 'loading' && <p role="status">Getting the forecast…</p>}
        {status === 'unavailable' && (
          <p role="status">
            The forecast isn’t available. Check that this site may use your location, or{' '}
            <button type="button" onClick={() => save({ ...prefs, enabled: false })} className="font-semibold underline">turn the forecast off</button>.
          </p>
        )}
        {status === 'ready' && todayForecast && (
          <p data-forecast-today>
            Today’s forecast: <span className="font-semibold">{todayForecast.label}</span>
            {todayForecast.rainProbabilityPct >= 20 ? `, ${todayForecast.rainProbabilityPct}% chance of rain` : ''}.
            {chosen ? ` You chose a ${themeLabel(chosen)}.` : ` It looks like a ${themeLabel(suggested!)}.`}
          </p>
        )}
      </div>

      {nextRain && (
        <div className="mt-3 flex flex-wrap items-start gap-3 rounded-xl border border-sky-300 bg-sky-50 p-3" data-rain-alert>
          <CloudRain className="mt-0.5 h-5 w-5 shrink-0 text-sky-800" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm text-sky-950">
            <p className="font-semibold">
              Rain {when(nextRain)} ({nextRain.label.toLowerCase()}, {nextRain.rainProbabilityPct}% chance).
              {rain.length > 1 ? ` And ${rain.length - 1} more rain ${rain.length === 2 ? 'day' : 'days'} this week.` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {themes[nextRain.date] === 'grey' ? (
                <span className="inline-flex items-center gap-2">
                  {dayName(nextRain)} is a Grey Day.
                  <button type="button" onClick={() => onChoose(nextRain.date, null)} className="font-semibold underline">Undo</button>
                </span>
              ) : (
                <button type="button" onClick={() => onChoose(nextRain.date, 'grey')} className="rounded-lg bg-sky-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-900">
                  Make {dayName(nextRain) === 'Today' ? 'today' : dayName(nextRain)} a Grey Day
                </button>
              )}
              {better && onMoveOwnTasks && hasOwnTasksOn?.(nextRain.weekday) && (
                <button type="button" onClick={() => onMoveOwnTasks(nextRain.weekday, better.weekday)} className="rounded-lg border border-sky-700 px-3 py-1.5 text-xs font-semibold text-sky-950 hover:bg-sky-100">
                  Move your own {nextRain.weekday} tasks to {better.weekday} ({better.rainProbabilityPct}% rain)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {status !== 'off' && status !== 'pending' && (
        <details className="mt-3 text-sm text-slate-800">
          <summary className="cursor-pointer font-medium">Weather settings</summary>
          <div className="mt-2 space-y-2">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={prefs.rainAlerts !== false} onChange={(e) => save({ ...prefs, rainAlerts: e.target.checked })} />
              Tell me when a rain day is coming
            </label>
            <fieldset>
              <legend className="font-medium">Days you prefer for your own tasks</legend>
              <div className="mt-1 flex flex-wrap gap-3">
                {(['no_preference', 'sunny', 'rain'] as const).map((p) => (
                  <label key={p} className="flex items-center gap-1.5">
                    <input type="radio" name="weather-preference" className="h-4 w-4" checked={prefs.preference === p} onChange={() => save({ ...prefs, preference: p })} />
                    {p === 'no_preference' ? 'No preference' : p === 'sunny' ? 'Sunny days' : 'Rainy days'}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="button" onClick={() => save({ ...prefs, enabled: false, autoMatch: false })} className="font-semibold underline">
              Turn the forecast off
            </button>
            <p className="text-xs text-slate-700">
              <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline">{FORECAST_CREDIT}<span className="sr-only"> (opens in a new tab)</span></a>. It gets this device’s approximate location, about 10 km.
            </p>
          </div>
        </details>
      )}
    </div>
  )
}
