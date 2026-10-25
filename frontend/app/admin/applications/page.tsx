'use client'

import { useEffect, useState } from 'react'
import BackButton from '../../components/BackButton'

interface Waiting {
  resourceId: string
  name: string
  category: string | null
  website: string | null
  phone: string | null
  waiting: number
  oldest: string | null
}

/**
 * One-click Apply's waiting list (app/api/admin/applications): services
 * people applied to that have no email address on their listing. Find the
 * address the service takes new people at (its website's contact page),
 * save it, and everything waiting goes out by itself; or mark it
 * unreachable, and the people who applied see that. Team only.
 */
export default function ApplicationsAdminPage() {
  const [services, setServices] = useState<Waiting[] | null>(null)
  const [error, setError] = useState('')
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const load = () =>
    fetch('/api/admin/applications', { cache: 'no-store', credentials: 'include' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) setError(j.error || 'Could not load.')
        else setServices(j.services || [])
      })
      .catch(() => setError('Could not load.'))

  useEffect(() => {
    load()
  }, [])

  const act = async (s: Waiting, body: Record<string, unknown>) => {
    setBusy(s.resourceId)
    const r = await fetch('/api/admin/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ resourceId: s.resourceId, ...body }),
    }).catch(() => null)
    const j = await r?.json().catch(() => null)
    setBusy(null)
    if (!r?.ok) {
      setNote(`${s.name}: ${j?.error || 'That didn’t work.'}`)
      return
    }
    setNote(
      body.unreachable
        ? `${s.name}: marked unreachable (${j.unreachable}).`
        : `${s.name}: address saved. Sent ${j.sent}${j.failed ? `, ${j.failed} didn’t send` : ''}.`,
    )
    load()
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <BackButton fallback="/path" />
        <h1 className="text-2xl font-bold text-slate-900">Applications waiting for an address</h1>
        <p className="text-slate-800">
          People pressed Apply on these services, and their listings have no email address. Add the address the service takes new
          people at, and what is waiting goes out at once (each person gets a copy). If there is none, mark it unreachable: the
          people who applied see that, with the phone number if the listing has one.
        </p>
        {error ? (
          <p className="text-red-800">{error}</p>
        ) : !services ? (
          <p className="text-slate-700">Loading…</p>
        ) : services.length === 0 ? (
          <p className="text-slate-800">Nothing is waiting.</p>
        ) : (
          <ul className="space-y-3">
            {services.map((s) => (
              <li key={s.resourceId} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">
                  {s.name} <span className="font-normal text-slate-700">· {s.category || 'Service'}</span>
                </p>
                <p className="mt-1 text-sm text-slate-800">
                  {s.waiting} waiting{s.oldest ? ` since ${new Date(s.oldest).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}` : ''}
                  {s.phone ? ` · ${s.phone}` : ''}
                  {s.website ? (
                    <>
                      {' · '}
                      <a href={s.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-800 underline underline-offset-2">
                        Their website<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </>
                  ) : null}
                </p>
                <form
                  className="mt-3 flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    act(s, { email: emails[s.resourceId] || '' })
                  }}
                >
                  <label className="flex-1 text-sm font-semibold text-slate-900">
                    Their email address
                    <input
                      type="email"
                      required
                      value={emails[s.resourceId] || ''}
                      onChange={(e) => setEmails((prev) => ({ ...prev, [s.resourceId]: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                    />
                  </label>
                  <button type="submit" disabled={busy === s.resourceId} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60">
                    Save and send {s.waiting}
                  </button>
                  <button
                    type="button"
                    disabled={busy === s.resourceId}
                    onClick={() => act(s, { unreachable: true })}
                    className="rounded-lg border border-slate-400 px-4 py-2 font-semibold text-slate-800 disabled:opacity-60"
                  >
                    No address: unreachable
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p role="status" aria-live="polite" className="min-h-[1.25rem] text-slate-900">
          {note}
        </p>
      </div>
    </main>
  )
}
