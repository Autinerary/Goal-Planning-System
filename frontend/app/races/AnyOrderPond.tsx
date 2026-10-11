'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'

/**
 * Races in any order (Riipen Labs, Group 34, slide 23): the milestones as
 * lily pads on a pond (clouds in the night sky), so it's clear they don't
 * have to be done one after another. Choose a pad to hop onto it: open the
 * step, or mark it done or not done. Milestones could always be ticked in any
 * order; the other views just drew them as a line.
 */

export interface PondMilestone {
  id: string
  name: string
  goal?: string
  dimensionLabel?: string
}

// A gentle up-and-down so the pads don't sit in rows.
const DRIFT = [0, 22, 8, 30, 12, 26, 4, 18]

export default function AnyOrderPond({ milestones, completedIds, onToggle, day, character }: {
  milestones: PondMilestone[]
  completedIds: Set<string>
  onToggle: (id: string) => void
  /** Day theme: lily pads on water. Night: clouds. */
  day: boolean
  character?: ReactNode
}) {
  const [selected, setSelected] = useState<string | null>(null)

  // One pond for each goal, in the order the goals come.
  const ponds = useMemo(() => {
    const byGoal = new Map<string, PondMilestone[]>()
    for (const m of milestones) {
      const key = m.goal || ''
      byGoal.set(key, [...(byGoal.get(key) || []), m])
    }
    return Array.from(byGoal.entries())
  }, [milestones])

  const done = milestones.filter((m) => completedIds.has(m.id)).length
  const chosen = milestones.find((m) => m.id === selected) || null
  const chosenDone = chosen ? completedIds.has(chosen.id) : false

  const water = day ? 'bg-gradient-to-b from-sky-200 via-cyan-200 to-teal-200 border-teal-300' : 'bg-gradient-to-b from-indigo-900 via-indigo-800 to-slate-900 border-indigo-700'
  const pad = (isDone: boolean, isSelected: boolean) => {
    const base = day
      ? `rounded-[50%] border-4 ${isDone ? 'border-emerald-700 bg-emerald-300' : 'border-emerald-800 bg-emerald-200'}`
      : `rounded-[40px] border-2 ${isDone ? 'border-amber-300 bg-white' : 'border-slate-300 bg-slate-100'}`
    return `${base} ${isSelected ? 'ring-4 ring-amber-400 ring-offset-2' : ''} relative flex h-28 w-36 flex-col items-center justify-center px-3 text-center shadow-md transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-600`
  }

  if (milestones.length === 0) return null

  return (
    <div className="mx-auto w-full max-w-4xl px-2 pb-8 pt-4">
      <p className={`mb-3 text-center text-sm font-medium ${day ? 'text-slate-800' : 'text-indigo-100'}`}>
        {done} of {milestones.length} done. Do them in any order: choose a {day ? 'lily pad' : 'cloud'} to hop onto it.
      </p>

      {ponds.map(([goal, list], p) => (
        <section
          key={goal || p}
          aria-label={goal ? `Milestones for ${goal}` : 'Milestones'}
          className={`mb-6 rounded-[2.5rem] border-2 p-5 ${water}`}
        >
          {goal && <h3 className={`mb-3 text-center font-bold ${day ? 'text-teal-950' : 'text-white'}`}>{goal}</h3>}
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-3 pb-6">
            {list.map((m, i) => {
              const isDone = completedIds.has(m.id)
              const isSelected = selected === m.id
              return (
                <li key={m.id} style={{ marginTop: DRIFT[i % DRIFT.length] }}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(isSelected ? null : m.id)}
                    className={pad(isDone, isSelected)}
                  >
                    {isSelected && character && <span className="keep-colors absolute -top-7" aria-hidden="true">{character}</span>}
                    <span aria-hidden="true" className="text-lg leading-none">{isDone ? (day ? '🪷' : '⭐') : ''}</span>
                    <span className="line-clamp-3 text-xs font-semibold leading-snug text-slate-900">{m.name}</span>
                    {isDone && <span className="sr-only">, done</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div aria-live="polite" className="min-h-[1px]">
        {chosen && (
          <div className={`mx-auto max-w-xl rounded-2xl border-2 p-4 shadow-sm ${day ? 'border-slate-200 bg-white' : 'border-indigo-700 bg-indigo-950'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${day ? 'text-slate-600' : 'text-indigo-300'}`}>
              {chosen.dimensionLabel || 'Milestone'}{chosenDone ? ' · done' : ''}
            </p>
            <h3 className={`mt-1 text-lg font-bold ${day ? 'text-slate-900' : 'text-white'}`}>{chosen.name}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/milestones/${chosen.id}`} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800">
                Open this step
              </Link>
              <button
                type="button"
                onClick={() => onToggle(chosen.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${chosenDone
                  ? (day ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50' : 'border-indigo-500 text-indigo-100 hover:bg-indigo-900')
                  : 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800'}`}
              >
                {chosenDone ? 'Mark as not done' : 'Mark as done'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
