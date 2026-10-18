'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Kind = 'survey' | 'reviewed'

/**
 * Admins only: the V1.5 emails to services (the planning note, October
 * 2026, Goal 11), in batches. Shows who the next batch would reach; sends
 * only after typing SEND.
 */
export default function OutreachPage() {
  const [kind, setKind] = useState<Kind>('survey')
  const [info, setInfo] = useState<{ ready?: boolean; next?: number; sample?: { name: string; email: string; ratings: number }[]; error?: string } | null>(null)
  const [confirm, setConfirm] = useState('')
  const [limit, setLimit] = useState(50)
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  const load = (k: Kind) => {
    setInfo(null)
    fetch(`/api/admin/provider-outreach?kind=${k}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ error: 'Could not load.' }))
  }
  useEffect(() => load(kind), [kind])

  const send = async () => {
    setBusy(true)
    const res = await fetch('/api/admin/provider-outreach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, confirm, limit }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setBusy(false)
    setConfirm('')
    setResult(res?.ok ? `Sent ${d.sent}${d.failed ? `, ${d.failed} failed` : ''}.` : d?.error || 'Could not send.')
    load(kind)
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold text-slate-900">Emails to services</h1>
        <p className="mt-2 text-slate-800">
          Each service gets each email once, at the address its listing publishes. Services that reply “stop” go in
          service_email_optouts and are skipped.
        </p>
        <div className="mt-4 flex gap-3">
          {(
            [
              ['survey', 'The survey: what would you like in your account?'],
              ['reviewed', 'You were rated this month (with the survey)'],
            ] as [Kind, string][]
          ).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-slate-900">
              <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} className="h-4 w-4" />
              {l}
            </label>
          ))}
        </div>
        {!info ? (
          <p className="mt-4 text-slate-700">Looking…</p>
        ) : info.error ? (
          <p className="mt-4 text-red-800">{info.error}</p>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-slate-900">
              The next batch: <strong>{info.next}</strong> service{info.next === 1 ? '' : 's'} (up to 200).
            </p>
            {!info.ready && <p className="text-red-800">Email isn&apos;t set up (RESEND_API_KEY and NEWSLETTER_POSTAL_ADDRESS).</p>}
            <ul className="list-disc pl-5 text-sm text-slate-800">
              {info.sample?.map((s, i) => (
                <li key={i}>
                  {s.name} · {s.email}
                  {kind === 'reviewed' ? ` · ${s.ratings} rating${s.ratings === 1 ? '' : 's'}` : ''}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-4">
              <label className="block text-sm font-medium text-slate-900">
                How many
                <input type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-900">
                Type SEND
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <button type="button" onClick={send} disabled={confirm !== 'SEND' || busy || !info.ready || !info.next} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-60">
                {busy ? 'Sending…' : 'Send this batch'}
              </button>
            </div>
            {result && <p role="status">{result}</p>}
          </div>
        )}
        <p className="mt-8 text-sm">
          <Link href="/business" className="font-medium text-indigo-800 underline underline-offset-2">
            Resource Accounts
          </Link>
        </p>
      </article>
    </div>
  )
}
