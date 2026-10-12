'use client'

import { useState, type FormEvent } from 'react'

/**
 * A town or city, saved to the profile so ResourceHub can show services near
 * the person (app/api/me/location). Setup asked for it until Riipen Labs,
 * Group 26: "remove ... Location" from onboarding, and ask for it with
 * "profile completion" and in ResourceHub ("Set your location", which
 * ResourceHub already has). Used by the "Complete your profile" card.
 *
 * The browser can fill it in (autocomplete), so there is less to type
 * (Group 26: "autofill, autocomplete, or predictive text").
 */
export default function LocationField({
  initial,
  onSaved,
  idPrefix = 'location',
}: {
  initial?: { city: string; province: string; country: string } | null
  onSaved?: (location: { city: string; province: string; country: string }) => void
  idPrefix?: string
}) {
  const [loc, setLoc] = useState({ city: initial?.city || '', province: initial?.province || '', country: initial?.country || '' })
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!loc.city.trim()) {
      setState('error')
      setError('Please enter a town or city.')
      return
    }
    setState('saving')
    try {
      const res = await fetch('/api/me/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setState('error')
        setError(res.status === 422 ? "We couldn't find that place. Check the spelling, or try a nearby city." : body.error || 'Could not save. Please try again.')
        return
      }
      setState('saved')
      onSaved?.({ city: loc.city.trim(), province: loc.province.trim(), country: loc.country.trim() })
    } catch {
      setState('error')
      setError('Could not reach the server. Please try again.')
    }
  }

  const field = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500'
  return (
    <form onSubmit={save} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label htmlFor={`${idPrefix}-city`} className="mb-1 block text-xs font-semibold text-slate-800">Town or city</label>
          <input id={`${idPrefix}-city`} value={loc.city} onChange={(e) => { setLoc({ ...loc, city: e.target.value }); setState('idle') }} autoComplete="address-level2" maxLength={100} className={field} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-province`} className="mb-1 block text-xs font-semibold text-slate-800">Province or state</label>
          <input id={`${idPrefix}-province`} value={loc.province} onChange={(e) => { setLoc({ ...loc, province: e.target.value }); setState('idle') }} autoComplete="address-level1" maxLength={100} className={field} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-country`} className="mb-1 block text-xs font-semibold text-slate-800">Country</label>
          <input id={`${idPrefix}-country`} value={loc.country} onChange={(e) => { setLoc({ ...loc, country: e.target.value }); setState('idle') }} autoComplete="country-name" maxLength={100} className={field} />
        </div>
        <button
          type="submit"
          disabled={state === 'saving'}
          className="self-end rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-700"
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="text-xs text-slate-700">Private: only used to sort services by distance. You can change it here any time.</p>
      {state === 'error' && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {state === 'saved' && <p className="text-sm text-emerald-800" role="status">Saved. ResourceHub will show places near {loc.city.trim()}.</p>}
    </form>
  )
}
