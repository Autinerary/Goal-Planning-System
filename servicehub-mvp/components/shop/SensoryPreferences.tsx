'use client'

import { useEffect, useState } from 'react'
import { TASTE_QUALITIES } from '@/lib/shop/taste'
import { qualityLabel } from '@/lib/shop/qualities'

type Choice = 'like' | 'avoid' | ''

/**
 * What you like and avoid in products (the products round, v1.5: taste
 * profiles). Optional, only yours; the shop can then sort by what matches
 * you, and once enough people answer, you may be placed in a taste profile
 * with people whose answers are like yours.
 */
export default function SensoryPreferences() {
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [open, setOpen] = useState(true)
  const [profile, setProfile] = useState<{ label: string; size: number } | null>(null)
  const [saved, setSaved] = useState('')
  useEffect(() => {
    fetch('/api/me/sensory-preferences', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.open === false) return setOpen(false)
        const c: Record<string, Choice> = {}
        for (const l of d.likes || []) c[l] = 'like'
        for (const a of d.avoids || []) c[a] = 'avoid'
        setChoices(c)
        setProfile(d.profile || null)
      })
      .catch(() => setOpen(false))
  }, [])
  if (!open) return null

  const save = async (next: Record<string, Choice>) => {
    setChoices(next)
    const res = await fetch('/api/me/sensory-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ likes: Object.keys(next).filter((k) => next[k] === 'like'), avoids: Object.keys(next).filter((k) => next[k] === 'avoid') }),
    }).catch(() => null)
    setSaved(res?.ok ? 'Saved.' : 'Could not save that.')
  }

  return (
    <section aria-labelledby="taste-heading" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 id="taste-heading" className="text-lg font-semibold text-gray-900">
        What you like and avoid in products
      </h2>
      <p className="mt-1 text-sm text-gray-800">Optional, and only yours to see. The shop can then put what matches you first.</p>
      {profile && (
        <p className="mt-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-950">
          Your taste profile: <strong>{profile.label}</strong> (with {profile.size} others who answered like you).
        </p>
      )}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {TASTE_QUALITIES.map((q) => (
          <li key={q} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2">
            <span className="text-sm text-gray-900">{qualityLabel(q)}</span>
            <span role="group" aria-label={qualityLabel(q)} className="flex gap-1">
              {(['like', 'avoid'] as Choice[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={choices[q] === c}
                  onClick={() => save({ ...choices, [q]: choices[q] === c ? '' : c })}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${choices[q] === c ? (c === 'like' ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-red-700 bg-red-50 text-red-900') : 'border-gray-300 text-gray-800 hover:bg-gray-50'}`}
                >
                  {c === 'like' ? 'Like' : 'Avoid'}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {saved && (
        <p role="status" className="mt-2 text-sm text-gray-800">
          {saved}
        </p>
      )}
    </section>
  )
}
