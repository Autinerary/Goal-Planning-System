'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/contact'

/**
 * /emails/requests-stop?e=&t=: "Stop them", from a request Sign me up
 * emailed to a local service (lib/requestLinks.ts). It stops every email from
 * Autinerary to that address (service_email_optouts): requests, and our own
 * emails to services. One button, so a mail app opening the link does nothing
 * by itself.
 */
export default function RequestsStopPage() {
  const [link, setLink] = useState<{ e: string; t: string }>({ e: '', t: '' })
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setLink({ e: q.get('e') || '', t: q.get('t') || '' })
  }, [])
  const confirm = async () => {
    setState('working')
    const res = await fetch('/api/emails/requests-stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(link) }).catch(() => null)
    setState(res?.ok ? 'done' : 'error')
  }
  const address = link.e || 'this address'
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{state === 'done' ? 'Done' : 'Stop requests to this address'}</h1>
        {state === 'done' ? (
          <p role="status" className="mt-3 text-slate-800">Autinerary won’t email <span className="font-semibold break-all">{address}</span> again. People can still find your listing and contact you themselves.</p>
        ) : state === 'error' ? (
          <p role="status" className="mt-3 text-slate-800">This link did not work. Email {CONTACT_EMAIL} and we will stop them for you.</p>
        ) : (
          <>
            <p className="mt-3 text-slate-800">
              People using Autinerary can ask it to send a service their request to start. Stop sending them to <span className="font-semibold break-all">{address}</span>?
              Autinerary won’t email it at all after that.
            </p>
            <button type="button" onClick={confirm} disabled={!link.e || !link.t || state === 'working'} className="mt-6 rounded-xl bg-indigo-700 px-6 py-3 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
              {state === 'working' ? 'Saving…' : 'Stop requests'}
            </button>
          </>
        )}
        <p className="mt-6 text-sm">
          <Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">What is Autinerary?</Link>
        </p>
      </div>
    </main>
  )
}
