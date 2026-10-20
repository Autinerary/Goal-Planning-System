/**
 * A day's weather theme in the Calendar (Odosa, October 2026: "a final layer
 * of options for 'Grey Day' & 'Sunny Day', under the energy buttons"; "tell
 * when a rain day is coming & offer to switch day to that's theme"; "an
 * option in the customization of animals & themes to automatically match the
 * energy level to weather").
 *
 * A theme is chosen for a date, or comes from the forecast when there is
 * one; a choice always wins. It colours that day in the Calendar, adds an
 * idea that fits it, and on the day itself turns the app's sky bright or
 * grey. Rain and snow are grey days. Plain data and pure functions
 * (lib/dayTheme.test.mjs).
 */

import type { DayForecast, DayKind } from './weather'
import type { SkyPrefs } from './sky'

export type DayTheme = 'sunny' | 'grey'
export type EnergyLevel = 'worst' | 'average' | 'best'

export const DAY_THEMES: { id: DayTheme; label: string; icon: string }[] = [
  { id: 'sunny', label: 'Sunny Day', icon: '☀️' },
  { id: 'grey', label: 'Grey Day', icon: '☁️' },
]

export const themeLabel = (t: DayTheme) => DAY_THEMES.find((x) => x.id === t)!.label

/** A local date as YYYY-MM-DD (the key themes and energy are kept under). */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const themeOfKind = (kind: DayKind): DayTheme => (kind === 'sunny' ? 'sunny' : 'grey')

/** The theme for a date: the one chosen, else the forecast's, else none. */
export function themeForDay(chosen: Record<string, DayTheme> | undefined, date: string, forecast?: DayForecast | null): { theme: DayTheme | null; from: 'chosen' | 'forecast' | null } {
  const mine = chosen?.[date]
  if (mine === 'sunny' || mine === 'grey') return { theme: mine, from: 'chosen' }
  if (forecast) return { theme: themeOfKind(forecast.kind), from: 'forecast' }
  return { theme: null, from: null }
}

/** Choose a date's theme, or clear it (null). Keeps the last 60 days and the next 30. */
export function setDayTheme(map: Record<string, DayTheme> | undefined, date: string, theme: DayTheme | null, today: Date = new Date()): Record<string, DayTheme> {
  const from = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 60))
  const to = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30))
  const next: Record<string, DayTheme> = {}
  for (const [d, t] of Object.entries(map || {})) {
    if (d !== date && d >= from && d <= to && (t === 'sunny' || t === 'grey')) next[d] = t
  }
  if (theme) next[date] = theme
  return next
}

/**
 * The energy level that matches the weather: a sunny day high energy, a grey
 * one balanced, rain or snow low.
 */
export function energyForKind(kind: DayKind): EnergyLevel {
  return kind === 'sunny' ? 'best' : kind === 'grey' ? 'average' : 'worst'
}

export const ENERGY_LABEL: Record<EnergyLevel, string> = { worst: 'Low Energy', average: 'Balanced', best: 'High Energy' }

/** For spirit animals kept for fast and slow days. */
export const paceForKind = (kind: DayKind): 'fast' | 'slow' | 'unknown' => (kind === 'sunny' ? 'fast' : kind === 'grey' ? 'unknown' : 'slow')

/** The sky on a themed day: bright with its colours, or cloudy and grey. */
export function skyForTheme(theme: DayTheme): Pick<SkyPrefs, 'light' | 'clouds' | 'cloudColour'> {
  return theme === 'sunny' ? { light: 'bright', clouds: true, cloudColour: 100 } : { light: 'cloudy', clouds: true, cloudColour: 0 }
}

/** The energy level chosen each day, for Analysis. Keeps half a year. */
export function recordEnergy(map: Record<string, EnergyLevel> | undefined, level: EnergyLevel, today: Date = new Date()): Record<string, EnergyLevel> {
  const from = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 183))
  const next: Record<string, EnergyLevel> = {}
  for (const [d, l] of Object.entries(map || {})) if (d >= from && (l === 'worst' || l === 'average' || l === 'best')) next[d] = l
  next[dateKey(today)] = level
  return next
}
