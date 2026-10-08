'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const OPTIONS = [
  { value: 1, label: 'Not useful' },
  { value: 2, label: 'A little' },
  { value: 3, label: 'Somewhat' },
  { value: 4, label: 'Useful' },
  { value: 5, label: 'Very useful' },
]

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

/**
 * "How useful was this step for you?" on a milestone's page: the first real
 * signal about plans (there are no reflections yet). Optional; rating again
 * replaces the answer shown, and the history is kept (backend
 * api/routes/milestone_ratings.py, STEP 54). Renders nothing until ratings
 * are available, so it never shows a control that cannot save.
 */
export default function MilestoneRating({ pathId, milestoneId }: { pathId?: string; milestoneId: string }) {
  const [available, setAvailable] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (!pathId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/milestone-ratings/${encodeURIComponent(pathId)}`, { headers: await authHeaders() })
        const json = res.ok ? await res.json() : null
        if (cancelled || !json?.available) return
        setAvailable(true)
        const current = json.ratings?.[milestoneId]
        if (typeof current === 'number') setRating(current)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [pathId, milestoneId])

  if (!pathId || !available) return null

  const rate = async (value: number) => {
    setRating(value)
    setState('saving')
    try {
      const res = await fetch(`${API_URL}/api/milestone-ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ pathId, milestoneId, rating: value }),
      })
      setState(res.ok ? 'saved' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <section aria-labelledby="milestone-rating-heading" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 id="milestone-rating-heading" className="font-semibold text-slate-900">How useful was this step for you?</h2>
      <p className="mt-0.5 text-sm text-slate-700">Optional. Your answers help Autinerary plan better steps.</p>
      <div role="group" aria-labelledby="milestone-rating-heading" className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={rating === o.value}
            disabled={state === 'saving'}
            onClick={() => rate(o.value)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              rating === o.value ? 'border-indigo-700 bg-indigo-50 text-indigo-950' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p role="status" className="mt-2 text-sm text-slate-700">
        {state === 'saved' ? 'Thank you. Saved.' : state === 'error' ? 'This could not be saved just now. Please try again.' : ''}
      </p>
    </section>
  )
}
