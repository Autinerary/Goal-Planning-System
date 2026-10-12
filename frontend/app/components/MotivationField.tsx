'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import { backendAuthHeaders } from '@/lib/backendAuth'
import { MOTIVATION_OPTIONS, LIFE_STAGES, cleanMotivation } from '@/lib/motivationChoices'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * "What motivates you?" and "What life stage are you in?", the setup step
 * that moved into the app (Riipen Labs, Groups 25 to 30). Saved with the
 * account (profiles.preferences.motivation), then the person's matching
 * profile is rebuilt so the answer counts when plans are made
 * (backend: POST /api/pattern/reindex, core/pattern_reindex.py). Both are
 * optional; either can be left empty.
 */
export default function MotivationField({ onSaved }: { onSaved?: () => void }) {
  const { prefs, update } = usePreferences()
  const start = cleanMotivation(prefs.motivation)
  const [types, setTypes] = useState<string[]>(start.types)
  const [stages, setStages] = useState<string[]>(start.lifeStages)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const toggleType = (id: string) => {
    setTypes((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
    setState('idle')
  }
  const toggleStage = (id: string) => {
    setStages((s) => {
      // "I'm not sure" is the absence of an answer, so it stands alone.
      if (id === 'not_sure') return s.includes(id) ? [] : ['not_sure']
      const rest = s.filter((x) => x !== 'not_sure')
      return rest.includes(id) ? rest.filter((x) => x !== id) : [...rest, id]
    })
    setState('idle')
  }

  async function save() {
    setState('saving')
    const ok = await update({ motivation: cleanMotivation({ types, lifeStages: stages, updatedAt: new Date().toISOString() }) })
    if (!ok) {
      setState('error')
      return
    }
    setState('saved')
    onSaved?.()
    // Best effort: the backend's own sweep rebuilds it later otherwise.
    backendAuthHeaders()
      .then((headers) => fetch(`${API_URL}/api/pattern/reindex`, { method: 'POST', headers, signal: AbortSignal.timeout(20000) }))
      .catch(() => {})
  }

  const chip = (on: boolean) =>
    `inline-flex items-center gap-1 rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
      on ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-400 bg-white text-slate-800 hover:border-indigo-500'
    }`

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-slate-900">What motivates you most? <span className="font-normal text-slate-700">(pick any)</span></legend>
        <div className="flex flex-wrap gap-2">
          {MOTIVATION_OPTIONS.map((o) => {
            const on = types.includes(o.value)
            return (
              <button key={o.value} type="button" aria-pressed={on} onClick={() => toggleType(o.value)} className={chip(on)} title={o.description}>
                {on && <Check className="h-4 w-4" aria-hidden="true" />}
                {o.label}
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-slate-700">
          {MOTIVATION_OPTIONS.filter((o) => types.includes(o.value)).map((o) => `${o.label}: ${o.description.toLowerCase()}.`).join(' ') || 'Most people are motivated by more than one thing.'}
        </p>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-slate-900">What life stage are you in? <span className="font-normal text-slate-700">(pick any)</span></legend>
        <div className="flex flex-wrap gap-2">
          {LIFE_STAGES.map((st) => {
            const on = stages.includes(st.id)
            return (
              <button key={st.id} type="button" aria-pressed={on} onClick={() => toggleStage(st.id)} className={chip(on)}>
                {on && <Check className="h-4 w-4" aria-hidden="true" />}
                {st.label}
              </button>
            )
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={state === 'saving' || (types.length === 0 && stages.length === 0)}
          className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-700"
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {state === 'saved' && <p role="status" className="text-sm text-emerald-800">Saved. You can change it here any time.</p>}
        {state === 'error' && <p role="alert" className="text-sm text-red-700">Saved on this device only. Try again when you are connected.</p>}
      </div>
    </div>
  )
}
