'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** Off unless NEXT_PUBLIC_SCHEDULE_FEEDBACK_ENABLED is 'true' (and the backend's SCHEDULE_FEEDBACK_ENABLED). */
export const SCHEDULE_FEEDBACK_ENABLED = process.env.NEXT_PUBLIC_SCHEDULE_FEEDBACK_ENABLED === 'true'

type Answer = 'yes' | 'no'

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

/**
 * "Did this schedule work for you?" under the week on the Calendar page: yes
 * or no, once for each generated schedule (backend
 * api/routes/schedule_feedback.py, STEP 72). Calendar Optimization had
 * nothing to judge a week by. Renders nothing unless the flag is on and the
 * backend can save the answer; once answered, it says what was answered and
 * doesn't ask again.
 */
export default function ScheduleFeedback({ pathId }: { pathId?: string }) {
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (!SCHEDULE_FEEDBACK_ENABLED || !pathId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/schedule-feedback/${encodeURIComponent(pathId)}`, { headers: await authHeaders() })
        const json = res.ok ? await res.json() : null
        if (cancelled || !json?.available || !json.scheduleId) return
        setScheduleId(json.scheduleId)
        if (json.answer === 'yes' || json.answer === 'no') setAnswer(json.answer)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [pathId])

  if (!SCHEDULE_FEEDBACK_ENABLED || !pathId || !scheduleId) return null

  if (answer) {
    return (
      <p role="status" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
        {state === 'saved' ? 'Thank you. ' : ''}You said this schedule {answer === 'yes' ? 'worked' : 'didn’t work'} for you.
      </p>
    )
  }

  const send = async (value: Answer) => {
    setState('saving')
    try {
      const res = await fetch(`${API_URL}/api/schedule-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ pathId, scheduleId, answer: value }),
      })
      const json = res.ok ? await res.json() : null
      if (json?.answer === 'yes' || json?.answer === 'no') {
        // An answer given earlier stands: show that one.
        setAnswer(json.answer)
        setState('saved')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  return (
    <section aria-labelledby="schedule-feedback-heading" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 id="schedule-feedback-heading" className="font-semibold text-slate-900">Did this schedule work for you?</h2>
      <p className="mt-0.5 text-sm text-slate-700">Optional, and asked once for each schedule. Your answer helps Autinerary plan better weeks.</p>
      <div role="group" aria-labelledby="schedule-feedback-heading" className="mt-3 flex flex-wrap gap-2">
        {(['yes', 'no'] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={state === 'saving'}
            onClick={() => send(value)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
          >
            {value === 'yes' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
      <p role="status" className="mt-2 text-sm text-slate-700">
        {state === 'error' ? 'This could not be saved just now. Please try again.' : ''}
      </p>
    </section>
  )
}
