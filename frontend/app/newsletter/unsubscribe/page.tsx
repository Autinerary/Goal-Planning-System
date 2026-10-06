'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/** /newsletter/unsubscribe?t=<token>: stop every email, with one button. */
export default function UnsubscribePage() {
  const [token, setToken] = useState('')
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('t') || ''), [])

  const stop = async () => {
    setState('working')
    const res = await fetch('/api/newsletter/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => null)
    setState(res?.ok ? 'done' : 'error')
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{state === 'done' ? 'You won’t get these emails again' : 'Stop emails from Autinerary'}</h1>
        {state === 'done' ? (
          <p role="status" className="mt-3 text-slate-800">Done. If you change your mind, you can sign up again on autinerary.ca.</p>
        ) : state === 'error' ? (
          <p role="status" className="mt-3 text-slate-800">This link did not work. Please email aayush@autinerary.ca and we will stop them.</p>
        ) : (
          <button type="button" onClick={stop} disabled={!token || state === 'working'} className="mt-6 rounded-xl bg-indigo-700 px-6 py-3 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
            {state === 'working' ? 'Stopping…' : 'Stop all emails'}
          </button>
        )}
        <p className="mt-6 text-sm"><Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">Go to Autinerary</Link></p>
      </div>
    </main>
  )
}
