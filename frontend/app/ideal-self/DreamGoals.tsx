'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { GOAL_AREAS } from '@/lib/goalAreas'

/**
 * Your Dream Self's goals (Riipen Labs, Group 34, slide 26): what the person
 * you're growing into has done, by area of life, written and changed by you.
 * They don't change your plan; "Make a plan" opens setup with that goal
 * added, the way a new path is made. Kept with your preferences
 * (dreamGoals). Until you write your own, the goals you gave in setup are
 * shown to start from.
 */

const MAX_GOALS = 8
const MAX_LENGTH = 120

type Goals = Record<string, string[]>

function fromSetup(goalsByCategory: unknown): Goals {
  const out: Goals = {}
  if (!goalsByCategory || typeof goalsByCategory !== 'object') return out
  for (const area of GOAL_AREAS) {
    const list = (goalsByCategory as Record<string, any>)[area.id]
    if (!Array.isArray(list)) continue
    const goals = list.map((e) => String(e?.goal || '').trim()).filter(Boolean).slice(0, MAX_GOALS)
    if (goals.length) out[area.id] = goals
  }
  return out
}

export default function DreamGoals({ saved, setupGoals, onSave }: {
  saved: Goals | undefined
  /** userProfile.goalsByCategory from the path, to start from. */
  setupGoals: unknown
  onSave: (goals: Goals) => Promise<boolean>
}) {
  const [goals, setGoals] = useState<Goals>(() => saved || fromSetup(setupGoals))
  const [adding, setAdding] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')

  // Saved goals arrive from the account after the first render.
  useEffect(() => { if (saved) setGoals(saved) }, [saved])
  useEffect(() => { if (!saved) setGoals(fromSetup(setupGoals)) }, [saved, setupGoals])

  const commit = async (next: Goals, message: string) => {
    const cleaned: Goals = {}
    for (const [area, list] of Object.entries(next)) {
      const kept = list.map((g) => g.trim()).filter(Boolean)
      if (kept.length) cleaned[area] = kept
    }
    setGoals(next)
    const ok = await onSave(cleaned)
    setStatus(ok ? message : 'Saved on this device only. Please try again when you are connected.')
  }

  const edit = (area: string, i: number, text: string) =>
    setGoals((g) => ({ ...g, [area]: (g[area] || []).map((x, j) => (j === i ? text.slice(0, MAX_LENGTH) : x)) }))

  const add = (area: string) => {
    const text = (adding[area] || '').trim().slice(0, MAX_LENGTH)
    if (!text) return
    setAdding((a) => ({ ...a, [area]: '' }))
    void commit({ ...goals, [area]: [...(goals[area] || []), text].slice(0, MAX_GOALS) }, `Added: ${text}`)
  }

  const remove = (area: string, i: number) => {
    const text = goals[area]?.[i] || ''
    void commit({ ...goals, [area]: (goals[area] || []).filter((_, j) => j !== i) }, `Removed: ${text}`)
  }

  return (
    <section aria-labelledby="dream-goals-heading" className="lg:col-span-2 rounded-2xl border border-slate-200 p-6 surface">
      <h3 id="dream-goals-heading" className="font-bold text-slate-800">Your Dream Self’s goals</h3>
      <p className="mt-1 text-sm text-slate-700">
        What your Dream Self has done, in each part of life. Write them in your own words and change them whenever you
        like; they don’t change your plan. To work towards one, choose Make a plan.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {GOAL_AREAS.map((area) => {
          const list = goals[area.id] || []
          return (
            <div key={area.id} role="group" aria-labelledby={`dream-area-${area.id}`} className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 id={`dream-area-${area.id}`} className="flex items-center gap-2 font-semibold text-slate-900">
                <span aria-hidden="true">{area.emoji}</span> {area.label}
              </h4>
              {list.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {list.map((goal, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 p-2">
                      <label htmlFor={`dream-${area.id}-${i}`} className="sr-only">{area.label} goal {i + 1}</label>
                      <input
                        id={`dream-${area.id}-${i}`}
                        value={goal}
                        maxLength={MAX_LENGTH}
                        onChange={(e) => edit(area.id, i, e.target.value)}
                        onBlur={() => void commit(goals, 'Saved.')}
                        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-slate-900 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none"
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-3 px-2">
                        <Link
                          href={`/onboarding?goal=${encodeURIComponent(goal)}&area=${area.id}`}
                          className="text-xs font-semibold text-indigo-800 underline underline-offset-2"
                        >
                          Make a plan<span className="sr-only">: {goal}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(area.id, i)}
                          aria-label={`Remove: ${goal}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-800 hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {list.length < MAX_GOALS && (
                <form onSubmit={(e) => { e.preventDefault(); add(area.id) }} className="mt-2 flex gap-2">
                  <label htmlFor={`dream-add-${area.id}`} className="sr-only">Add a goal for {area.label}</label>
                  <input
                    id={`dream-add-${area.id}`}
                    value={adding[area.id] || ''}
                    maxLength={MAX_LENGTH}
                    placeholder={area.placeholder}
                    onChange={(e) => setAdding((a) => ({ ...a, [area.id]: e.target.value }))}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                  <button type="submit" className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add
                  </button>
                </form>
              )}
            </div>
          )
        })}
      </div>
      <p role="status" className="mt-3 text-sm text-slate-700">{status}</p>
    </section>
  )
}
