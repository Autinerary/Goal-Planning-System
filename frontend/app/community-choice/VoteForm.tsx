'use client'

import { useState } from 'react'

interface Item {
  kind: 'service' | 'product' | 'article'
  item_id: string
  name: string
  url: string
  nominations: number
}

/** The ballot: one choice of each kind, saved with one button (a mail app opening the link does nothing). */
export default function VoteForm({
  month,
  monthLabel,
  groups,
  mine,
  v,
  t,
}: {
  month: string
  monthLabel: string
  groups: { id: string; plural: string; items: Item[] }[]
  mine: Record<string, string>
  v?: string
  t?: string
}) {
  const [picks, setPicks] = useState<Record<string, string>>(mine)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const vote = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/community-choice/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, picks, v, t }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error || 'Could not save your vote.')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your vote.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={vote} className="mt-6 space-y-6">
      {groups.map((g) => (
        <fieldset key={g.id} className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 font-semibold text-slate-900">{g.plural}</legend>
          <div className="space-y-2">
            {g.items.map((i) => (
              <label key={i.item_id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-amber-50">
                <input
                  type="radio"
                  name={`vote-${g.id}`}
                  value={i.item_id}
                  checked={picks[g.id] === i.item_id}
                  onChange={() => setPicks((p) => ({ ...p, [g.id]: i.item_id }))}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="font-medium text-slate-900">{i.name}</span>{' '}
                  <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-800 underline underline-offset-2">
                    See it
                  </a>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {done ? 'Your vote is saved.' : ''}
      </p>
      {done ? (
        <p className="rounded-lg bg-emerald-50 p-3 font-medium text-emerald-900">
          Your vote is saved. You can change it until {monthLabel} ends; the winners are announced on the 1st.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || Object.keys(picks).length === 0}
        className="rounded-lg bg-amber-800 px-5 py-2.5 font-semibold text-white hover:bg-amber-900 disabled:opacity-60"
      >
        {busy ? 'Saving…' : done ? 'Save my vote again' : 'Vote'}
      </button>
    </form>
  )
}
