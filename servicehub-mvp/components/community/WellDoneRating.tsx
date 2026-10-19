'use client'

import { useState } from 'react'
import { ChefHat } from 'lucide-react'

// The bakery words for each rating (the Tidbits round: "Well-Dones").
const LEVELS = ['Underbaked', 'Getting there', 'Good', 'Golden', 'Perfectly baked']

/**
 * Give a Tidbit a Well-Done, 1 to 5 (the Tidbits round's planning note,
 * Goals 3 and 10). Not on your own Tidbit; you can change it or take it back.
 */
export default function WellDoneRating({
  postId,
  initial,
  onDone,
}: {
  postId: string
  initial: number | null
  onDone: (result: { first: boolean; rating: number; well_done_count: number; well_done_avg: number | null }) => void
}) {
  const [rating, setRating] = useState<number | null>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const rate = async (n: number) => {
    if (busy) return
    setBusy(true)
    setError('')
    const res = await fetch(`/api/community/posts/${postId}/well-done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rating: n }),
    }).catch(() => null)
    const d = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) return setError(d?.error || 'That didn’t save. Please try again.')
    setRating(n)
    onDone(d)
  }

  return (
    <section aria-labelledby="well-done-heading" className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <h2 id="well-done-heading" className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <ChefHat className="h-5 w-5 text-amber-700" aria-hidden="true" /> How well done is it?
      </h2>
      <p className="mt-0.5 text-sm text-gray-800">Your Well-Done helps the best Tidbits reach more people.</p>
      <div role="group" aria-label="Well-Done, 1 to 5" className="mt-3 flex flex-wrap gap-2">
        {LEVELS.map((label, i) => {
          const n = i + 1
          const on = rating === n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              disabled={busy}
              onClick={() => rate(n)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${on ? 'border-amber-700 bg-amber-700 text-white' : 'border-amber-300 bg-white text-gray-900 hover:bg-amber-100'}`}
            >
              {n} · {label}
            </button>
          )
        })}
      </div>
      {rating !== null && <p className="mt-2 text-sm text-gray-800">You gave it {rating} out of 5. Choose another to change it.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </section>
  )
}
