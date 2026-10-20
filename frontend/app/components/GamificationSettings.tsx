'use client'

import { useEffect, useState } from 'react'
import { usePreferences } from '../context/usePreferences'
import { ANIMAL_COLORS, ANIMAL_TYPES, SPIRIT_MODES, WEEKDAYS, normalizeGamification, slotCount, slotLabel, type GamificationPreferences } from '@/lib/gamification'

export function useGamification() {
  const { prefs, update, saveError } = usePreferences()
  const [legacy, setLegacy] = useState<Partial<GamificationPreferences>>({})
  useEffect(() => {
    try {
      const profile = JSON.parse(localStorage.getItem('autinerary_profile') || '{}')
      setLegacy({ animals: profile.preferences?.spiritAnimals, mode: profile.preferences?.spiritAnimalMode })
    } catch {}
  }, [])
  return { value: normalizeGamification(prefs.gamification || legacy), saveError, save: (value: GamificationPreferences) => update({ gamification: normalizeGamification(value) }) }
}

export default function GamificationSettings() {
  const { value, save, saveError } = useGamification()
  const patch = (change: Partial<GamificationPreferences>) => save({ ...value, ...change })
  const setTheme = (field: 'monthlyThemes' | 'weeklyThemes' | 'dailyThemes', index: number, text: string) => {
    const items = [...value[field]]
    items[index] = text
    patch({ [field]: items })
  }
  // #spirit-animals: the "Complete your profile" card links here (Riipen Labs,
  // Groups 25 to 30: spirit animals left setup for the app).
  return <section id="spirit-animals" className="my-6 scroll-mt-24 border-y border-slate-200 py-4" aria-labelledby="spirit-animals-heading">
    <h2 id="spirit-animals-heading" className="mb-1 text-xl font-semibold text-slate-900">Spirit animals and themes</h2>
    <p className="mb-4 text-sm text-slate-700">Spirit animals are friendly guides shown at the top of your Path: one for every day, one for busy and one for lighter days, or one per weekday.</p>
    {saveError && <p role="alert" className="mb-3 text-sm text-red-700">{saveError}</p>}
    {/* One choice decides how many animals there are: one, two (fast and slow
        days) or seven (the week). A separate count and mode let the labels say
        "Fast day" for a single animal, and the 1/2 or 1/7 counts only
        appeared after choosing one animal first (Odosa, October 2026). */}
    <fieldset>
      <legend className="text-sm font-medium text-slate-900">How many spirit animals?</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {SPIRIT_MODES.map((m) => (
          <label key={m.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${value.mode === m.id ? 'border-slate-900 bg-slate-50' : 'border-slate-300'}`}>
            <input type="radio" name="spirit-mode" value={m.id} checked={value.mode === m.id} onChange={() => patch({ mode: m.id })} className="mt-0.5 h-4 w-4" />
            <span><span className="block font-medium text-slate-900">{m.label}</span><span className="text-slate-700">{m.note}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {Array.from({ length: slotCount(value.mode) }, (_, index) => {
        const animal = value.animals[index] || { type: '', color: 'orange' }
        const label = slotLabel(value.mode, index)
        // Choosing for a slot fills any empty ones before it, so the order holds.
        const setSlot = (change: Partial<typeof animal>) => patch({ animals: Array.from({ length: Math.max(value.animals.length, index + 1) }, (_, position) => position === index ? { ...animal, ...change } : value.animals[position] || { type: '', color: 'orange' }) })
        return <fieldset key={`${value.mode}-${index}`} className="flex min-w-0 flex-wrap items-center gap-2 border-b pb-3">
          <legend className="mb-1 text-sm font-medium">{label}</legend>
          {animal.type && <img src={`/spirit-animals/${animal.type}.png`} alt="" width={40} height={40} style={{ filter: `hue-rotate(${ANIMAL_COLORS[animal.color]}deg)` }} />}
          <select aria-label={label} value={animal.type} onChange={event => setSlot({ type: event.target.value })} className="max-w-full rounded border p-2 text-sm"><option value="">Not chosen yet</option>{ANIMAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>
          <div role="group" aria-label={`${label}: colour`} className="flex flex-wrap gap-2">{Object.keys(ANIMAL_COLORS).map(color => <button key={color} type="button" title={color} aria-label={`${label}: ${color}`} aria-pressed={animal.color === color} onClick={() => setSlot({ color })} className={`h-6 w-6 rounded-full border-2 ${animal.color === color ? 'border-slate-900 ring-2 ring-offset-2 ring-slate-600' : 'border-slate-300'}`} style={{ backgroundColor: color }} />)}</div>
        </fieldset>
      })}
    </div>
    {/* The team's notes, October 2026: "an option in the customization of
        animals & themes to automatically match the energy level to weather". */}
    <fieldset className="mt-5 rounded-lg border border-slate-300 p-3" data-energy-from-weather>
      <legend className="px-1 text-sm font-medium text-slate-900">Weather</legend>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={value.energyFromWeather === true} onChange={(event) => patch({ energyFromWeather: event.target.checked })} />
        <span>
          <span className="block font-medium text-slate-900">Match each day’s energy to the weather</span>
          <span className="block text-slate-700">A sunny day is a high-energy day, a grey one balanced, and rain or snow low. With two spirit animals, the fast one shows on sunny days and the slow one on rainy days. It uses the Calendar’s local forecast, and an energy level you choose for the day always wins.</span>
        </span>
      </label>
    </fieldset>
    <label className="mt-6 block text-sm">Yearly theme<input maxLength={100} value={value.yearlyTheme} onChange={event => patch({ yearlyTheme: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label>
    <details className="mt-4"><summary className="cursor-pointer font-medium">Monthly themes</summary><div className="mt-3 grid gap-3 sm:grid-cols-3">{Array.from({ length: 12 }, (_, index) => <label key={index} className="text-sm">{new Date(2026, index, 1).toLocaleString('en', { month: 'long' })}<input maxLength={100} value={value.monthlyThemes[index] || ''} onChange={event => setTheme('monthlyThemes', index, event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>)}</div></details>
    <details className="mt-4"><summary className="cursor-pointer font-medium">Weekly themes</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{WEEKDAYS.map((day, index) => <label key={day} className="text-sm">{day}<input maxLength={100} value={value.weeklyThemes[index] || ''} onChange={event => setTheme('weeklyThemes', index, event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>)}</div></details>
    <label className="mt-4 block text-sm">Daily themes (0-31)<input aria-label="Number of daily themes" type="number" min={0} max={31} value={value.dailyThemes.length} onChange={event => patch({ dailyThemes: Array.from({ length: Math.max(0, Math.min(31, Math.trunc(Number(event.target.value) || 0))) }, (_, index) => value.dailyThemes[index] || '') })} className="mt-1 block w-24 rounded border p-2" /></label>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">{value.dailyThemes.map((theme, index) => <label key={index} className="text-sm">Day {index + 1} of month<input maxLength={100} value={theme} onChange={event => setTheme('dailyThemes', index, event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>)}</div>
  </section>
}