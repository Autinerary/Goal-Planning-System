'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ListChecks } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import MediaPlayer from './MediaPlayer'
import { HOW_TO, lengthLabel } from '@/lib/media'

/**
 * "Getting started": three first things to try, each ticked off when done.
 *
 * Riipen Labs, Group 11: "a 'how to use the app' video and starter checklist
 * after onboarding: 1. Save one resource 2. Add a milestone 3. Try the
 * calendar in low-energy mode." Milestones come with the plan rather than
 * being added, so the second is finishing one step of it, the first win the
 * Path already points to.
 *
 * It waits its turn in the Path's one-card slot (app/path/page.tsx): shown
 * only when no check-in, skipped setup question or offer to show more is
 * waiting, and gone once all three are done or it is hidden.
 */

const HIDE_KEY = 'autinerary_starter_checklist_hidden'
// Set by the calendar when someone chooses its Low Energy day.
export const LOW_ENERGY_TRIED_KEY = 'autinerary_tried_low_energy'

export default function StarterChecklist({ stepsDone }: { stepsDone: number }) {
  const { supabaseUser } = useAuth()
  const [hidden, setHidden] = useState(true)
  const [lowEnergy, setLowEnergy] = useState(false)
  const [saved, setSaved] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === '1')
      setLowEnergy(localStorage.getItem(LOW_ENERGY_TRIED_KEY) === '1')
    } catch {
      setHidden(false)
    }
  }, [])

  // Saved in ResourceHub, which shares the account and the database.
  useEffect(() => {
    if (!supabaseUser?.id) return
    let cancelled = false
    createClient()
      .from('saved_resources')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', supabaseUser.id)
      .then(({ count, error }: { count: number | null; error: unknown }) => {
        if (!cancelled) setSaved(!error && (count ?? 0) > 0)
      })
    return () => {
      cancelled = true
    }
  }, [supabaseUser?.id])

  const items = [
    {
      done: saved === true,
      title: 'Save one resource',
      body: 'Find a service or tool in ResourceHub and save it, so it is there when you need it.',
      href: '/go/servicehub?next=/search',
      cta: 'Open ResourceHub',
    },
    {
      done: stepsDone > 0,
      title: 'Finish one step of your plan',
      body: 'Open your next step, above, and mark it done when you have done it.',
    },
    {
      done: lowEnergy,
      title: 'Try a low-energy day',
      body: 'In the calendar, choose Low Energy to see a lighter version of your day.',
      href: '/calendar',
      cta: 'Open the calendar',
    },
  ]

  if (hidden || saved === null || items.every((i) => i.done)) return null
  const doneCount = items.filter((i) => i.done).length

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, '1')
    } catch {}
    setHidden(true)
  }

  return (
    <section className="mb-6 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm" aria-labelledby="starter-heading">
      <h2 id="starter-heading" className="flex items-center gap-2 font-bold text-slate-900">
        <ListChecks className="h-5 w-5 text-indigo-700" aria-hidden="true" /> Getting started
        <span className="text-sm font-medium text-slate-700">{doneCount} of {items.length} done</span>
      </h2>
      <ol className="mt-3 space-y-3">
        {items.map((item, i) => (
          <li key={item.title} className="flex gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                item.done ? 'bg-emerald-700 text-white' : 'border border-slate-400 text-slate-700'
              }`}
              aria-hidden="true"
            >
              {item.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="text-sm">
              <p className={`font-semibold ${item.done ? 'text-slate-700 line-through' : 'text-slate-900'}`}>
                {item.title}
                {item.done && <span className="sr-only"> (done)</span>}
              </p>
              {!item.done && (
                <p className="text-slate-700">
                  {item.body}
                  {item.href && (
                    <>
                      {' '}
                      <Link href={item.href} className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
                        {item.cta}
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-indigo-800 underline underline-offset-2">
          Watch how to use your Path ({lengthLabel(HOW_TO.seconds)})
        </summary>
        <div className="mt-3 max-w-xl">
          <MediaPlayer item={HOW_TO} />
        </div>
      </details>
      <button type="button" onClick={hide} className="mt-3 text-sm font-medium text-slate-800 underline underline-offset-2 hover:text-slate-950">
        Hide this list
      </button>
    </section>
  )
}
