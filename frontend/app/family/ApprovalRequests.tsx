'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface Request {
  id: string
  name: string
  email: string
  age: number | null
  asked: string
}

/**
 * Teens who asked this adult to approve their account (STEP 84; the team's
 * note: "trusted legal adult who HAS AN ACCOUNT be able to sign in, review
 * info, and approve account"). The adult reviews their name, email and age,
 * says whether they are a parent or legal guardian, and approves or declines.
 * Nothing shows until someone has asked.
 */
export default function ApprovalRequests({ onApproved }: { onApproved: () => void }) {
  const [requests, setRequests] = useState<Request[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [relationship, setRelationship] = useState<'parent' | 'legal_guardian' | ''>('')
  const [consent, setConsent] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string; plan?: boolean } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/family/requests', { cache: 'no-store', credentials: 'include' }).catch(() => null)
    const j = await res?.json().catch(() => null)
    setRequests(j?.requests || [])
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const decide = async (id: string, action: 'approve' | 'decline') => {
    setBusy(true)
    setMessage(null)
    const res = await fetch(`/api/family/requests/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, relationship, legalGuardianConsent: consent, reviewed }),
    }).catch(() => null)
    const j = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) return setMessage({ ok: false, text: j?.error || 'That didn’t work. Please try again.', plan: j?.code === 'plan' })
    setMessage({ ok: true, text: action === 'approve' ? 'Approved. Their account is open, and you can see it below.' : 'Declined. Their account stays locked.' })
    setOpen(null)
    setRelationship('')
    setConsent(false)
    setReviewed(false)
    await load()
    if (action === 'approve') onApproved()
  }

  if (!requests.length && !message) return null
  return (
    <section aria-labelledby="approval-requests-heading" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <h2 id="approval-requests-heading" className="font-semibold text-slate-900">Asked to approve you</h2>
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.ok ? 'text-emerald-900' : 'text-red-800'}`}>
          {message.text} {message.plan && <Link href="/pricing" className="font-medium underline">See plans</Link>}
        </p>
      )}
      <ul className="mt-2 space-y-3">
        {requests.map((r) => (
          <li key={r.id} className="rounded-xl border border-amber-200 bg-white p-3">
            <p className="text-sm text-slate-900">
              <strong>{r.name || 'Someone'}</strong>
              {r.age !== null ? `, ${r.age}` : ''} ({r.email}) asked you, as their parent or legal guardian, to approve their account.
            </p>
            {open !== r.id ? (
              <div className="mt-2 flex flex-wrap gap-3">
                <button type="button" onClick={() => setOpen(r.id)} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800">
                  Review
                </button>
                <button type="button" disabled={busy} onClick={() => decide(r.id, 'decline')} className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                  Decline
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-sm text-slate-900">
                <fieldset>
                  <legend className="font-medium">You are their</legend>
                  <div className="mt-1 flex flex-wrap gap-4">
                    {([['parent', 'Parent'], ['legal_guardian', 'Legal guardian']] as const).map(([id, label]) => (
                      <label key={id} className="flex items-center gap-2">
                        <input type="radio" name={`rel-${r.id}`} checked={relationship === id} onChange={() => setRelationship(id)} className="h-4 w-4" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  I have checked their name, email and age above.
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  I am their parent or legal guardian, and I agree to their using Autinerary with me supervising their account.
                </label>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button type="button" disabled={busy || !relationship || !consent || !reviewed} onClick={() => decide(r.id, 'approve')} className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                    Approve
                  </button>
                  <button type="button" disabled={busy} onClick={() => decide(r.id, 'decline')} className="rounded-lg border border-slate-400 px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-50">
                    Decline
                  </button>
                  <button type="button" onClick={() => setOpen(null)} className="text-slate-700 underline underline-offset-2">
                    Not now
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
