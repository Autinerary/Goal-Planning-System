'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Action = 'snooze3' | 'snooze7' | 'stop'

const ASK: Record<Action, { title: string; body: string; button: string }> = {
  snooze3: { title: 'Remind me in 3 days', body: 'We’ll wait three days before the next reminder to finish setting up.', button: 'Remind me in 3 days' },
  snooze7: { title: 'Remind me in a week', body: 'We’ll wait a week before the next reminder to finish setting up.', button: 'Remind me in a week' },
  stop: { title: 'Stop these reminders', body: 'No more reminders to finish setting up. Nothing else changes, and you can set up any time.', button: 'Stop these reminders' },
}

/**
 * /emails/setup-reminder?u=&t=&a=: the choices in a reminder to finish setup
 * (Riipen Labs, Group 24: "finish now, remind me in a few days, or stop
 * reminders"). One button, so a mail app opening the link does nothing by
 * itself.
 */
export default function SetupReminderChoicePage() {
  const [link, setLink] = useState<{ u: string; t: string; a: Action }>({ u: '', t: '', a: 'stop' })
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [until, setUntil] = useState<string | null>(null)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const a = q.get('a') as Action
    setLink({ u: q.get('u') || '', t: q.get('t') || '', a: a in ASK ? a : 'stop' })
  }, [])

  const confirm = async () => {
    setState('working')
    const res = await fetch('/api/emails/setup-reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(link) }).catch(() => null)
    if (res?.ok) {
      const data = await res.json().catch(() => ({}))
      setUntil(data?.until || null)
      setState('done')
    } else setState('error')
  }

  const ask = ASK[link.a]
  const when = until ? new Date(`${until}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) : null
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{state === 'done' ? 'Done' : ask.title}</h1>
        {state === 'done' ? (
          <p role="status" className="mt-3 text-slate-800">
            {link.a === 'stop'
              ? 'You won’t get more reminders to finish setting up. Your other emails and settings are unchanged.'
              : `The next reminder won’t come before ${when || 'then'}. You can still finish any time.`}
          </p>
        ) : state === 'error' ? (
          <p role="status" className="mt-3 text-slate-800">This link did not work. Email aayush@autinerary.ca and we will change it for you.</p>
        ) : (
          <>
            <p className="mt-3 text-slate-800">{ask.body}</p>
            <button type="button" onClick={confirm} disabled={!link.u || !link.t || state === 'working'} className="mt-6 rounded-xl bg-indigo-700 px-6 py-3 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
              {state === 'working' ? 'Saving…' : ask.button}
            </button>
          </>
        )}
        <p className="mt-6 text-sm">
          <Link href="/onboarding?from=setup-reminder" className="font-medium text-indigo-800 underline underline-offset-2">Or finish setting up now</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">Go to Autinerary</Link>
        </p>
      </div>
    </main>
  )
}
