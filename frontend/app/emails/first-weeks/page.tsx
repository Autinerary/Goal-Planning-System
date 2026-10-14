'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/contact'

/**
 * /emails/first-weeks?u=&t=: "Stop these emails" from one of the first two
 * weeks' emails (lib/firstWeeks.ts). One button, so a mail app opening the
 * link does nothing by itself.
 */
export default function FirstWeeksStopPage() {
  const [link, setLink] = useState<{ u: string; t: string }>({ u: '', t: '' })
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setLink({ u: q.get('u') || '', t: q.get('t') || '' })
  }, [])
  const confirm = async () => {
    setState('working')
    const res = await fetch('/api/emails/first-weeks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...link, a: 'stop' }) }).catch(() => null)
    setState(res?.ok ? 'done' : 'error')
  }
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{state === 'done' ? 'Done' : 'Stop these emails'}</h1>
        {state === 'done' ? (
          <p role="status" className="mt-3 text-slate-800">You won’t get the rest of the emails about your first two weeks. Your other emails and settings are unchanged.</p>
        ) : state === 'error' ? (
          <p role="status" className="mt-3 text-slate-800">This link did not work. Email {CONTACT_EMAIL} and we will stop them for you.</p>
        ) : (
          <>
            <p className="mt-3 text-slate-800">No more emails about your first two weeks. Nothing else changes.</p>
            <button type="button" onClick={confirm} disabled={!link.u || !link.t || state === 'working'} className="mt-6 rounded-xl bg-indigo-700 px-6 py-3 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
              {state === 'working' ? 'Saving…' : 'Stop these emails'}
            </button>
          </>
        )}
        <p className="mt-6 text-sm">
          <Link href="/path" className="font-medium text-indigo-800 underline underline-offset-2">Open your Path</Link>
        </p>
      </div>
    </main>
  )
}
