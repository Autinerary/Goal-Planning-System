'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * /newsletter/confirm?t=<token>: the link in the confirmation email. The
 * address is confirmed only when the button is pressed, so a mail scanner
 * opening the link confirms nothing (app/api/newsletter/confirm).
 */
export default function ConfirmPage() {
  const [token, setToken] = useState('')
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('t') || ''), [])

  const confirm = async () => {
    setState('working')
    const res = await fetch('/api/newsletter/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => null)
    const json = await res?.json().catch(() => ({}))
    if (res?.ok) {
      setState('done')
      setMessage(
        [json.listSent ? 'Your list is on its way to your inbox.' : json.list ? 'Your list could not be sent just now; we will not send anything else.' : '',
          json.weekly ? 'The weekly email starts next week. Every one has a link to stop it.' : ''].filter(Boolean).join(' '),
      )
    } else {
      setState('error')
      setMessage(json?.error || 'Something went wrong. Please try again.')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{state === 'done' ? 'Confirmed. Thank you.' : 'Confirm your email'}</h1>
        {state === 'done' || state === 'error' ? (
          <p role="status" className="mt-3 text-slate-800">{message}</p>
        ) : (
          <>
            <p className="mt-3 text-slate-800">Press the button to confirm you asked Autinerary for this. If you didn&apos;t, close this page and nothing will be sent.</p>
            <button type="button" onClick={confirm} disabled={!token || state === 'working'} className="mt-6 rounded-xl bg-indigo-700 px-6 py-3 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
              {state === 'working' ? 'Confirming…' : 'Yes, confirm my email'}
            </button>
          </>
        )}
        <p className="mt-6 text-sm"><Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">Go to Autinerary</Link></p>
      </div>
    </main>
  )
}
