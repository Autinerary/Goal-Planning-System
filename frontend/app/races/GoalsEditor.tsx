'use client'

import { useState } from 'react'
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { backendAuthHeaders } from '@/lib/backendAuth'
import { loadPreferences } from '@/lib/preferences'
import { GOAL_AREAS } from '@/lib/goalAreas'
import type { GoalArea } from '@/lib/goalCategories'
import { SharedBadge, type Collab } from './GoalsTogether'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const AREA = Object.fromEntries(GOAL_AREAS.map((a) => [a.id, a])) as Record<string, (typeof GOAL_AREAS)[number]>

type GoalRow = { text: string; from: string | null; area: GoalArea }

/**
 * "Your Goals, Dreams & Obstacles", changed right here (the team's notes,
 * October 2026: "customizable here, so someone doesn't need to re-do the
 * entire onboarding"). Saved with the plan by the backend (PUT
 * /api/paths/me/profile, core/profile_edit.py) after the same checks as
 * setup: a renamed goal keeps its race and steps, a goal taken out is hidden
 * (not deleted), and a new goal can get its own steps without touching the
 * rest of the plan (POST /api/paths/me/goal-steps).
 */
export default function GoalsEditor({
  day,
  goals,
  areas,
  dreams,
  obstacles,
  ultimateDream,
  progressFor,
  goalsWithoutSteps,
  sharedFor,
  onSaved,
  onUltimateDream,
}: {
  day: boolean
  goals: string[]
  areas: Record<string, GoalArea>
  dreams: string[]
  obstacles: string[]
  ultimateDream: string
  progressFor: (goal: string) => number | null
  goalsWithoutSteps: string[]
  sharedFor: (goal: string) => Collab | null
  onSaved: () => Promise<void> | void
  onUltimateDream: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<GoalRow[]>([])
  const [dreamRows, setDreamRows] = useState<string[]>([])
  const [obstacleRows, setObstacleRows] = useState<string[]>([])
  const [biggest, setBiggest] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [building, setBuilding] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const txt = day ? 'text-slate-900' : 'text-white'
  const sub = day ? 'text-slate-700' : 'text-indigo-200'
  const field = `w-full rounded-lg border px-2 py-1.5 text-sm ${day ? 'border-slate-300 bg-white text-slate-900' : 'border-indigo-600 bg-indigo-950 text-white'}`

  const start = () => {
    setRows(goals.map((g) => ({ text: g, from: g, area: areas[g] || 'other' })))
    setDreamRows([...dreams])
    setObstacleRows([...obstacles])
    setBiggest(ultimateDream)
    setError('')
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const auth = await backendAuthHeaders()
      const res = await fetch(`${API_URL}/api/paths/me/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          goals: rows.filter((r) => r.text.trim()).map((r) => ({ text: r.text, from: r.from, area: r.area })),
          dreams: dreamRows.filter((d) => d.trim()),
          obstacles: obstacleRows.filter((o) => o.trim()),
          ultimateDream: biggest,
        }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof j?.detail === 'string' ? j.detail : 'That didn’t save. Try again.')
        return
      }
      onUltimateDream(biggest.trim())
      setEditing(false)
      setNote(j?.goalsWithoutSteps?.length ? 'Saved. New goals can get their own steps below.' : 'Saved.')
      await onSaved()
    } catch {
      setError('That didn’t save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const buildSteps = async (goal: string) => {
    setBuilding(goal)
    setNote(`Building steps for “${goal}”. This can take a minute.`)
    try {
      const auth = await backendAuthHeaders()
      const res = await fetch(`${API_URL}/api/paths/me/goal-steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ goal, languageStyle: loadPreferences().languageStyle || null }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) setNote(typeof j?.detail === 'string' ? j.detail : 'The steps couldn’t be built. Try again later.')
      else {
        setNote(j?.added ? `Added ${j.added} steps for “${goal}”. They aren’t on your calendar yet.` : `“${goal}” has its steps already.`)
        await onSaved()
      }
    } catch {
      setNote('The steps couldn’t be built. Try again later.')
    } finally {
      setBuilding(null)
    }
  }

  const list = (items: string[], set: (v: string[]) => void, label: string, placeholder: string) => (
    <fieldset className="mt-4">
      <legend className={`text-sm font-bold ${txt}`}>{label}</legend>
      <div className="mt-1 space-y-2">
        {items.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => set(items.map((v, j) => (j === i ? e.target.value : v)))}
              maxLength={300}
              aria-label={`${label}, ${i + 1}`}
              className={field}
            />
            <button type="button" onClick={() => set(items.filter((_, j) => j !== i))} aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} className={`rounded p-1 ${sub} hover:text-red-700`}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        {items.length < 10 && (
          <button type="button" onClick={() => set([...items, ''])} className={`inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2 ${day ? 'text-sky-800' : 'text-sky-200'}`}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {placeholder}
          </button>
        )}
      </div>
    </fieldset>
  )

  return (
    <div className="mt-3" data-goals-editor>
      {!editing ? (
        <>
          {ultimateDream && (
            <p className={`mb-3 text-sm ${txt}`}><span className="font-bold">🌈 Biggest dream:</span> {ultimateDream}</p>
          )}
          {goals.length > 0 && (
            <div className="mb-3">
              <div className={`mb-1 text-[0.625rem] font-bold uppercase tracking-wide ${sub}`}>🎯 Goals ({goals.length})</div>
              {goals.map((goal) => {
                const progress = progressFor(goal)
                const area = AREA[areas[goal] || 'other']
                const shared = sharedFor(goal)
                const noSteps = goalsWithoutSteps.includes(goal)
                return (
                  <div key={goal} className={`border-b py-2 ${shared ? 'border-teal-400' : day ? 'border-slate-200' : 'border-indigo-700'}`}>
                    <div className={`flex flex-wrap items-center justify-between gap-2 text-sm ${txt}`}>
                      <span className="break-words">
                        <span aria-hidden="true">{area?.emoji} </span>{goal}
                        <span className={`ml-2 text-xs ${sub}`}>{area?.label}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {shared && <SharedBadge collab={shared} small />}
                        {noSteps ? 'No steps yet' : progress === null ? 'No linked milestones' : `${progress}%`}
                      </span>
                    </div>
                    {!noSteps && progress !== null && <progress aria-label={`${goal} progress`} value={progress} max={100} className="mt-1 h-2 w-full" />}
                    {noSteps && (
                      <button
                        type="button"
                        onClick={() => buildSteps(goal)}
                        disabled={!!building}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
                      >
                        {building === goal ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                        Build steps for this goal
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {dreams.length > 0 && (
            <div className="mb-3">
              <div className={`mb-1 text-[0.625rem] font-bold uppercase tracking-wide ${sub}`}>🌟 Dreams</div>
              <div className="flex flex-wrap gap-1.5">
                {dreams.map((d, i) => (
                  <span key={i} className={`rounded-full px-2 py-1 text-[0.6875rem] ${day ? 'border border-purple-200 bg-purple-50 text-purple-800' : 'border border-purple-800 bg-purple-900/30 text-purple-200'}`}>{d}</span>
                ))}
              </div>
            </div>
          )}
          {obstacles.length > 0 && (
            <div className="mb-3">
              <div className={`mb-1 text-[0.625rem] font-bold uppercase tracking-wide ${sub}`}>⛰️ Obstacles</div>
              <div className="flex flex-wrap gap-1.5">
                {obstacles.map((o, i) => (
                  <span key={i} className={`rounded-full px-2 py-1 text-[0.6875rem] ${day ? 'border border-pink-200 bg-pink-50 text-pink-800' : 'border border-pink-800 bg-pink-900/30 text-pink-200'}`}>{o}</span>
                ))}
              </div>
            </div>
          )}
          <button type="button" onClick={start} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${day ? 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50' : 'border-indigo-500 bg-indigo-900 text-white'}`}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> Change goals, dreams or obstacles
          </button>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); save() }}>
          <label className={`block text-sm font-bold ${txt}`}>
            Your biggest dream
            <textarea value={biggest} onChange={(e) => setBiggest(e.target.value)} maxLength={300} rows={2} className={`${field} mt-1`} />
          </label>

          <fieldset className="mt-4">
            <legend className={`text-sm font-bold ${txt}`}>Goals</legend>
            <p className={`text-xs ${sub}`}>A goal shows under its area only. A goal you take out is hidden with its steps, not deleted: add it again to bring it back.</p>
            <div className="mt-2 space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    value={row.text}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, text: e.target.value } : r)))}
                    maxLength={200}
                    aria-label={`Goal ${i + 1}`}
                    className={`${field} min-w-0 flex-1`}
                  />
                  <select
                    value={row.area}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, area: e.target.value as GoalArea } : r)))}
                    aria-label={`Area for goal ${i + 1}`}
                    className={`${field} w-auto`}
                  >
                    {GOAL_AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                  <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Take out goal ${i + 1}`} className={`rounded p-1 ${sub} hover:text-red-700`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              {rows.length < 10 && (
                <button type="button" onClick={() => setRows([...rows, { text: '', from: null, area: 'other' }])} className={`inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2 ${day ? 'text-sky-800' : 'text-sky-200'}`}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add a goal
                </button>
              )}
            </div>
          </fieldset>

          {list(dreamRows, setDreamRows, 'Dreams', 'Add a dream')}
          {list(obstacleRows, setObstacleRows, 'Obstacles', 'Add an obstacle')}

          {error && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !rows.some((r) => r.text.trim())} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${day ? 'border-slate-300 text-slate-900' : 'border-indigo-500 text-white'}`}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <p className={`mt-2 min-h-[1rem] text-sm ${txt}`} role="status" aria-live="polite">{note}</p>
    </div>
  )
}
