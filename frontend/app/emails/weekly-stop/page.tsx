'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/** /emails/weekly-stop?u=<account id>&c=<code>: turn off the weekly email, with one button. */
export default function WeeklyStopPage() {
  const [link, setLink] = useState<{ u: string; c: string }>({ u: '', c: '' })
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setLink({ u: q.get('u') || '', c: q.get('c') || '' })
  }, [])

  const stop = async () => {
    setState('working')
    const res = await fetch('/api/emails/weekly-stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(link) }).catch(() => null)
    setState(res?.ok ? 'done' : 'error')
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{state === 'done' ? 'You won’t get the weekly email again' : 'Stop the weekly email'}</h1>
        {state === 'done' ? (
          <p role="status" className="mt-3 text-slate-800">Done. Your other emails and settings are unchanged. You can turn it back on in Settings, under Emails.</p>
        ) : state === 'error' ? (
          <p role="status" className="mt-3 text-slate-800">This link did not work. Sign in and turn it off in Settings, under Emails, or email aayush@autinerary.ca and we will stop it.</p>
        ) : (
          <>
            <p className="mt-3 text-slate-800">This stops the Monday email with what you saved and new picks. Nothing else changes.</p>
            <button type="button" onClick={stop} disabled={!link.u || !link.c || state === 'working'} className="mt-6 rounded-xl bg-indigo-700 px-6 py-3 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
              {state === 'working' ? 'Stopping…' : 'Stop the weekly email'}
            </button>
          </>
        )}
        <p className="mt-6 text-sm"><Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">Go to Autinerary</Link></p>
      </div>
    </main>
  )
}
