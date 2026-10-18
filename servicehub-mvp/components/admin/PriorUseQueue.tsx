'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Claim {
  id: string
  resource_id: string
  service: string
  email: string
  code: string
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  created_at: string
}

/**
 * Proof of use (Goal 5): people who used a service before joining send proof
 * to heydevs@autinerary.ca with their code. Match the email's sender and code
 * to a claim here, then approve (they can rate it) or reject. Delete the
 * email once checked, as the privacy page says.
 */
export default function PriorUseQueue() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [all, setAll] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')

  const load = () =>
    fetch(`/api/admin/prior-use${all ? '?status=all' : ''}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setClaims(d.claims || [])
        setNote(d.note || '')
      })
      .catch(() => setNote('Could not load the claims.'))

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all])

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id)
    const res = await fetch('/api/admin/prior-use', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
    setBusy('')
    if (res.ok) void load()
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <p className="text-sm">
        <Link href="/admin" className="font-medium text-blue-800 underline">
          Admin
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Proof of use</h1>
      <p className="mt-2 max-w-3xl text-gray-800">
        People who used a service before joining email their proof to heydevs@autinerary.ca with a code. Find the claim with the
        same code and address, look at the proof, then approve it (they can then rate the service) or reject it. Delete the email
        once you have checked it.
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm text-gray-900">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show decided ones too
      </label>
      {note && <p className="mt-4 text-sm text-gray-800">{note}</p>}
      {claims.length === 0 && !note ? (
        <p className="mt-6 text-gray-800">No claims waiting.</p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {claims.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  <span className="font-mono">{c.code}</span> · {c.service}
                </p>
                <p className="text-sm text-gray-800">
                  {c.email || 'No email found'} · {new Date(c.created_at).toLocaleDateString('en-CA')} · {c.status}
                </p>
                {c.note && <p className="mt-1 text-sm text-gray-800">“{c.note}”</p>}
              </div>
              {c.status === 'pending' && (
                <div className="flex gap-2">
                  <button type="button" disabled={busy === c.id} onClick={() => decide(c.id, 'approve')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                    Approve
                  </button>
                  <button type="button" disabled={busy === c.id} onClick={() => decide(c.id, 'reject')} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60">
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
