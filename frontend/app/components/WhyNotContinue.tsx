'use client'

import { useState } from 'react'
import { FEEDBACK_REASONS } from '@/lib/billing'

/**
 * The one question for people who didn't continue after the free month, or
 * cancelled (the planning note's Goal 9). Optional, and sent only when they
 * press Send.
 */
export default function WhyNotContinue({ moment, heading = 'Not continuing? Would you tell us why?' }: { moment: 'trial_end' | 'cancel'; heading?: string }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('busy')
    const res = await fetch('/api/me/subscription-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moment, reason: reason || null, details }),
    }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    if (res?.ok) setState('sent')
    else {
      setState('error')
      setError(d?.error || 'Could not send that just now.')
    }
  }

  if (state === 'sent')
    return (
      <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-slate-900">
        Thank you. The team reads every answer.
      </p>
    )

  return (
    <form onSubmit={send} className="rounded-xl border border-slate-200 bg-white p-5">
      <fieldset>
        <legend className="text-lg font-semibold text-slate-900">{heading}</legend>
        <p className="mt-1 text-sm text-slate-700">Optional. It helps us make Autinerary better, and cheaper.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {FEEDBACK_REASONS.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-900 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
              <input type="radio" name={`why-${moment}`} value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="h-4 w-4" />
              {r.label}
            </label>
          ))}
        </div>
        <label className="mt-3 block text-sm font-medium text-slate-900" htmlFor={`why-more-${moment}`}>
          Anything else (optional)
        </label>
        <textarea
          id={`why-more-${moment}`}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={2000}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
        />
      </fieldset>
      {state === 'error' && (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === 'busy' || (!reason && !details.trim())}
        className="mt-3 rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
      >
        {state === 'busy' ? 'Sending…' : 'Send'}
      </button>
    </form>
  )
}
