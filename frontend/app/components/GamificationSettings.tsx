'use client'

import { useEffect, useState } from 'react'
import { usePreferences } from '../context/usePreferences'
import { ANIMAL_COLORS, ANIMAL_TYPES, WEEKDAYS, normalizeGamification, type GamificationPreferences } from '@/lib/gamification'

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
  return <section className="my-6 border-y border-slate-200 py-4" aria-label="Gamification">
    <h2 className="mb-4 text-xl font-semibold text-slate-900">Gamification</h2>
    {saveError && <p role="alert" className="mb-3 text-sm text-red-700">{saveError}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Spirit animals (0-7)<input aria-label="Number of spirit animals" type="number" min={0} max={7} value={value.animals.length} onChange={event => {
        const count = Math.max(0, Math.min(7, Math.trunc(Number(event.target.value) || 0)))
        patch({ animals: Array.from({ length: count }, (_, index) => value.animals[index] || { type: '', color: 'orange' }) })
      }} className="mt-1 block w-full rounded border p-2" /></label>
      <label className="text-sm">Animal assignment<select value={value.mode} onChange={event => patch({ mode: event.target.value as GamificationPreferences['mode'] })} className="mt-1 block w-full rounded border p-2"><option value="general">General</option><option value="fastSlow">Fast / slow</option><option value="weekly">Weekdays</option></select></label>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {value.animals.map((animal, index) => <fieldset key={index} className="flex min-w-0 flex-wrap items-center gap-2 border-b pb-3">
        <legend className="mb-1 text-sm font-medium">{value.mode === 'weekly' ? WEEKDAYS[index] : value.mode === 'fastSlow' && index < 2 ? index === 0 ? 'Fast day' : 'Slow day' : index === 0 ? 'General guide' : `Unassigned guide ${index + 1}`}</legend>
        {animal.type && <img src={`/spirit-animals/${animal.type}.png`} alt="" width={40} height={40} style={{ filter: `hue-rotate(${ANIMAL_COLORS[animal.color]}deg)` }} />}
        <select aria-label={`Animal ${index + 1}`} value={animal.type} onChange={event => patch({ animals: value.animals.map((item, position) => position === index ? { ...item, type: event.target.value } : item) })} className="max-w-full rounded border p-2 text-sm"><option value="">Not assigned</option>{ANIMAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>
        <div role="group" aria-label={`Animal ${index + 1} color`} className="flex flex-wrap gap-2">{Object.keys(ANIMAL_COLORS).map(color => <button key={color} type="button" title={color} aria-label={`Animal ${index + 1}: ${color}`} aria-pressed={animal.color === color} onClick={() => patch({ animals: value.animals.map((item, position) => position === index ? { ...item, color } : item) })} className={`h-6 w-6 rounded-full border-2 ${animal.color === color ? 'border-slate-900 ring-2 ring-offset-2 ring-slate-600' : 'border-slate-300'}`} style={{ backgroundColor: color }} />)}</div>
      </fieldset>)}
    </div>
    <label className="mt-6 block text-sm">Yearly theme<input maxLength={100} value={value.yearlyTheme} onChange={event => patch({ yearlyTheme: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label>
    <details className="mt-4"><summary className="cursor-pointer font-medium">Monthly themes</summary><div className="mt-3 grid gap-3 sm:grid-cols-3">{Array.from({ length: 12 }, (_, index) => <label key={index} className="text-sm">{new Date(2026, index, 1).toLocaleString('en', { month: 'long' })}<input maxLength={100} value={value.monthlyThemes[index] || ''} onChange={event => setTheme('monthlyThemes', index, event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>)}</div></details>
    <details className="mt-4"><summary className="cursor-pointer font-medium">Weekly themes</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{WEEKDAYS.map((day, index) => <label key={day} className="text-sm">{day}<input maxLength={100} value={value.weeklyThemes[index] || ''} onChange={event => setTheme('weeklyThemes', index, event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>)}</div></details>
    <label className="mt-4 block text-sm">Daily themes (0-31)<input aria-label="Number of daily themes" type="number" min={0} max={31} value={value.dailyThemes.length} onChange={event => patch({ dailyThemes: Array.from({ length: Math.max(0, Math.min(31, Math.trunc(Number(event.target.value) || 0))) }, (_, index) => value.dailyThemes[index] || '') })} className="mt-1 block w-24 rounded border p-2" /></label>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">{value.dailyThemes.map((theme, index) => <label key={index} className="text-sm">Day {index + 1} of month<input maxLength={100} value={theme} onChange={event => setTheme('dailyThemes', index, event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>)}</div>
  </section>
}