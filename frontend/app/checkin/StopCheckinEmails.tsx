'use client'

import { useState } from 'react'

/** Turns the check-in email off from its link, no sign-in needed. */
export default function StopCheckinEmails({ token, prominent = false }: { token: string; prominent?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  async function stop() {
    setStatus('saving')
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop', token }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <p className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900" role="status">
        Done. We won&apos;t send you check-in emails. You can turn them back on in Settings.
      </p>
    )
  }

  const error = status === 'error' && (
    <p className="mt-2 text-sm text-red-700" role="alert">Could not update your settings. Please try again.</p>
  )

  if (prominent) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-slate-900">Stop check-in emails?</h1>
        <p className="mb-4 text-slate-700">
          We only send one when you haven&apos;t opened Autinerary for two weeks. Nothing else about your account changes.
        </p>
        <button
          type="button"
          onClick={stop}
          disabled={status === 'saving'}
          className="rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-700"
        >
          {status === 'saving' ? 'Saving…' : 'Stop check-in emails'}
        </button>
        {error}
      </div>
    )
  }

  return (
    <div className="text-sm text-slate-700">
      Don&apos;t want these emails?{' '}
      <button
        type="button"
        onClick={stop}
        disabled={status === 'saving'}
        className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-900"
      >
        {status === 'saving' ? 'Saving…' : 'Stop check-in emails'}
      </button>
      {error}
    </div>
  )
}
