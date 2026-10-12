'use client'

import { useState } from 'react'
import { Check, Users } from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import { AUDIENCES } from '@/lib/audiences'

/**
 * "Who you're here for" in Settings: setup's first question, which could not
 * be changed afterwards.
 *
 * Riipen Labs, Group 32: "siblings or parents need assurance that their
 * selected role will tailor the content visible to them". Setup now says the
 * answer decides what the app shows first and can be changed here, and the
 * Path's Quick Links say whose order they are in, with a link to this.
 *
 * It changes the order of Quick Links (lib/places.ts), the Path's card for
 * planning for someone else, and Start here's suggestions. The plan already
 * made stays as it is.
 */
export default function HereForSetting() {
  const { prefs, update } = usePreferences()
  const [status, setStatus] = useState('')
  const current = prefs.audience || ''

  const choose = async (id: string) => {
    if (id === current) return
    setStatus('Saving…')
    const saved = await update({ audience: id })
    setStatus(saved ? 'Saved.' : 'Saved on this device only. Try again when you are connected.')
  }

  return (
    <section id="here-for" aria-labelledby="here-for-heading" className="scroll-mt-24 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
      <h2 id="here-for-heading" className="text-xl font-bold mb-1 flex items-center gap-2">
        <Users className="w-5 h-5 text-cyan-700" aria-hidden="true" /> Who you&apos;re here for
      </h2>
      <p className="text-slate-700 mb-4 text-sm">
        This decides what the app shows you first, such as the order of Quick Links on your Path. Your plan stays as it is.
      </p>
      {!current && (
        <p className="-mt-2 mb-4 text-sm text-slate-700">
          Not answered yet, so the app shows what suits planning for yourself.
        </p>
      )}
      <div role="group" aria-labelledby="here-for-heading" className="grid gap-2 sm:grid-cols-2">
        {AUDIENCES.map((a) => {
          const on = current === a.id
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={on}
              onClick={() => choose(a.id)}
              className={`rounded-lg border-2 px-4 py-3 text-left text-sm font-medium shadow-sm transition-colors ${
                on ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-400 bg-white text-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40'
              }`}
            >
              {on && <Check className="mr-1 inline h-4 w-4" aria-hidden="true" />}
              {a.label}
              {a.hint && <span className="mt-0.5 block text-xs font-normal text-slate-700">{a.hint}</span>}
            </button>
          )
        })}
      </div>
      <p role="status" className="mt-3 min-h-[1.25rem] text-sm text-slate-700">{status}</p>
    </section>
  )
}
