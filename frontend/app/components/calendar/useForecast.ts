'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchForecast, getBrowserLocation, type DayForecast } from '@/lib/weather'

/**
 * The local forecast for the Calendar, once someone turns it on. Kept on this
 * device: the location it needs is this device's, with the browser's
 * permission. The forecast is kept for an hour in this browser session, so
 * moving between pages doesn't ask Open-Meteo again.
 */

export const WEATHER_PREFS_KEY = 'autinerary_weather_prefs'
const CACHE_KEY = 'autinerary_forecast'
const CACHE_MS = 60 * 60 * 1000

export interface WeatherPrefs {
  enabled?: boolean
  /** Which kind of day the user actually prefers to work on. */
  preference: 'rain' | 'sunny' | 'no_preference'
  /** Move their own repeating tasks off a day that doesn't suit, by itself. */
  autoMatch: boolean
  /** Say when a rain day is coming, and offer to make it a Grey Day (on unless turned off). */
  rainAlerts?: boolean
}

export function loadWeatherPrefs(): WeatherPrefs {
  try {
    const raw = localStorage.getItem(WEATHER_PREFS_KEY)
    if (raw) return { preference: 'no_preference', autoMatch: false, ...JSON.parse(raw) }
  } catch {}
  return { preference: 'no_preference', autoMatch: false }
}

export function saveWeatherPrefs(next: WeatherPrefs) {
  try { localStorage.setItem(WEATHER_PREFS_KEY, JSON.stringify(next)) } catch {}
  window.dispatchEvent(new CustomEvent('autinerary:weather'))
}

/** 'pending' until this device's setting is read, so the page doesn't flash "off". */
export type ForecastStatus = 'pending' | 'off' | 'loading' | 'ready' | 'unavailable'

const DEFAULT_PREFS: WeatherPrefs = { preference: 'no_preference', autoMatch: false }

export function useForecast() {
  const [prefs, setPrefs] = useState<WeatherPrefs | null>(null)
  const [forecast, setForecast] = useState<DayForecast[]>([])
  const [status, setStatus] = useState<ForecastStatus>('pending')
  const enabled = prefs ? Boolean(prefs.enabled) : null

  useEffect(() => {
    const sync = () => setPrefs(loadWeatherPrefs())
    sync()
    window.addEventListener('autinerary:weather', sync)
    return () => window.removeEventListener('autinerary:weather', sync)
  }, [])

  useEffect(() => {
    if (enabled === null) return
    if (!enabled) {
      setForecast([])
      setStatus('off')
      return
    }
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
      if (cached && Date.now() - cached.at < CACHE_MS && Array.isArray(cached.days) && cached.days.length) {
        setForecast(cached.days)
        setStatus('ready')
        return
      }
    } catch {}
    let cancelled = false
    setStatus('loading')
    getBrowserLocation()
      .then(({ lat, lon }) => fetchForecast(lat, lon))
      .then((days) => {
        if (cancelled) return
        setForecast(days)
        setStatus(days.length ? 'ready' : 'unavailable')
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), days })) } catch {}
      })
      .catch(() => { if (!cancelled) setStatus('unavailable') })
    return () => { cancelled = true }
  }, [enabled])

  const save = useCallback((next: WeatherPrefs) => {
    if (!next.enabled) {
      try { sessionStorage.removeItem(CACHE_KEY) } catch {}
    }
    setPrefs(next)
    saveWeatherPrefs(next)
  }, [])

  return { prefs: prefs || DEFAULT_PREFS, save, forecast, status }
}

/** The forecast for a date (YYYY-MM-DD), if the forecast reaches it. */
export const forecastOn = (forecast: DayForecast[], date: string) => forecast.find((d) => d.date === date) || null
