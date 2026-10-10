'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePreferences } from '../context/usePreferences'
import { savePreferences } from '@/lib/preferences'

/**
 * Shown on the Path while the account is paused (Your profile → Take a
 * break), with Resume, so a paused person always knows why nothing arrives.
 */
export default function PausedBanner() {
  const { prefs } = usePreferences()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const resume = async () => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/me/pause', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: false }),
      })
      if (!res.ok) throw new Error()
      savePreferences({ paused: null })
      setMessage('Welcome back. Your account is on again.')
    } catch {
      setMessage('That could not be saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!prefs.paused?.since) {
    return message ? <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{message}</p> : null
  }

  return (
    <section aria-label="Your account is paused" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm text-amber-950">
        <strong>Your account is paused.</strong> We aren’t sending you reminders, check-ins or notifications, and nobody can
        find you in search.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={resume}
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? 'Resuming…' : 'Resume my account'}
        </button>
        <Link href="/profile#pause" className="text-sm font-medium text-indigo-800 underline underline-offset-2">About pausing</Link>
      </div>
      <p role="status" className="mt-2 text-sm text-red-700">{message}</p>
    </section>
  )
}
