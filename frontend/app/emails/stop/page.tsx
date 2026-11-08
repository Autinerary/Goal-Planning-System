'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/contact'

const WHAT: Record<string, { title: string; ask: string; done: string; back: { label: string; href: string } }> = {
  reminders: {
    title: 'Stop daily reminders',
    ask: 'No more daily reminder emails. Nothing else changes.',
    done: 'No more daily reminder emails. Turn them on again any time in Settings, under Emails. Your other emails and settings are unchanged.',
    back: { label: 'Open your Path', href: '/path' },
  },
  vendor: {
    title: 'Stop discount event emails',
    ask: 'No more emails about discount events. They still show in your Resource Account, and nothing else changes.',
    done: 'No more emails about discount events. They still show in your Resource Account. Your listings and offers are unchanged.',
    back: { label: 'Open your Resource Account', href: '/business' },
  },
}

/**
 * /emails/stop?k=&u=&t=: "Stop these emails" from a daily reminder or a vendor's discount event email
 * (lib/emailStopLinks.ts). One button, so a mail app opening the link does nothing by itself.
 */
export default function StopEmailsPage() {
  const [link, setLink] = useState<{ k: string; u: string; t: string }>({ k: '', u: '', t: '' })
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setLink({ k: q.get('k') || '', u: q.get('u') || '', t: q.get('t') || '' })
  }, [])
  const what = WHAT[link.k] || { title: 'Stop these emails', ask: 'No more of these emails. Nothing else changes.', done: 'No more of these emails.', back: { label: 'Go to Autinerary', href: '/' } }
  const confirm = async () => {
    setState('working')
    const res = await fetch('/api/emails/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(link) }).catch(() => null)
    setState(res?.ok ? 'done' : 'error')
  }
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{state === 'done' ? 'Done' : what.title}</h1>
        {state === 'done' ? (
          <p role="status" className="mt-3 text-slate-800">{what.done}</p>
        ) : state === 'error' ? (
          <p role="status" className="mt-3 text-slate-800">This link did not work. Email {CONTACT_EMAIL} and we will stop them for you.</p>
        ) : (
          <>
            <p className="mt-3 text-slate-800">{what.ask}</p>
            <button type="button" onClick={confirm} disabled={!link.k || !link.u || !link.t || state === 'working'} className="mt-6 rounded-xl bg-indigo-700 px-6 py-3 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
              {state === 'working' ? 'Saving…' : 'Stop these emails'}
            </button>
          </>
        )}
        <p className="mt-6 text-sm">
          <Link href={what.back.href} className="font-medium text-indigo-800 underline underline-offset-2">{what.back.label}</Link>
        </p>
      </div>
    </main>
  )
}
