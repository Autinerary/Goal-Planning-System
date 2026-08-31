'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Check, Loader2, AlertCircle } from 'lucide-react'

/**
 * Where a peer confirms that someone shares a norm.
 *
 * Reached by a link the person themselves generated and sent. Norms are not
 * browsable: putting someone's disability, LGBTQ+ status or socioeconomic
 * situation on a public profile so strangers could vouch would be a serious
 * privacy regression. The person decides who is asked, and this page shows
 * only the single norm they asked about — nothing else from their profile.
 *
 * Every real guard lives server-side in /api/peers/vouch (lived experience,
 * account standing, no self-vouching). This page just explains and asks.
 */

const NORM_LABELS: Record<string, string> = {
  autism: 'Autism', adhd: 'ADHD', ocd: 'OCD', bipolar: 'Bipolar Disorder',
  sensory_deaf: 'Deaf or Hard of Hearing', sensory_blind: 'Blind or Low Vision',
  physical_wheelchair: 'Wheelchair User', physical_mobility: 'Mobility Challenges',
  intellectual: 'Intellectual Disabilities', chronic_health: 'Chronic Health Conditions',
  mental_health: 'Mental Health Considerations',
}
const normLabel = (t: string) =>
  NORM_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')

function VouchInner() {
  const params = useSearchParams()
  const userId = params.get('user') || ''
  const norm = (params.get('norm') || '').toLowerCase()

  const [status, setStatus] = useState<{ vouches: number; needed: number; youVouched: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!userId || !norm) { setLoading(false); return }
    fetch(`/api/peers/vouch?userId=${encodeURIComponent(userId)}&barrierType=${encodeURIComponent(norm)}`,
      { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && typeof j.vouches === 'number') setStatus(j) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId, norm])

  const submit = async (revoke: boolean) => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/peers/vouch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, barrierType: norm, revoke }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j?.error || 'Could not record that.'); return }
      setStatus({ vouches: j.vouches, needed: j.needed, youVouched: !revoke })
      setDone(!revoke)
    } finally {
      setBusy(false)
    }
  }

  if (!userId || !norm) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This vouch link is incomplete. Ask for a fresh one.
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Do you know this person shares {normLabel(norm)}?
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Someone asked you to confirm this because you share it too. You&apos;re only
              confirming what they already said about themselves — we never ask for
              paperwork, and nothing about a diagnosis is recorded.
            </p>
          </div>
        </div>

        {status && (
          <p className="mt-3 text-xs text-gray-500">
            {status.vouches} of {status.needed} vouches so far.
            {status.vouches < status.needed && ' Two are needed before the badge appears.'}
          </p>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {status?.youVouched || done ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <Check className="w-4 h-4" /> You vouched for this
              </span>
              <button
                onClick={() => submit(true)}
                disabled={busy}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {busy ? 'Withdrawing…' : 'Withdraw'}
              </button>
            </>
          ) : (
            <button
              onClick={() => submit(false)}
              disabled={busy}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Recording…' : 'Yes, I can vouch for this'}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Only vouch if you actually know this. It affects how much weight their ratings
        carry for everyone else. <Link href="/" className="underline">Back to ResourceHub</Link>
      </p>
    </div>
  )
}

export default function VouchPage() {
  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Vouch for a peer</h1>
      <p className="text-sm text-gray-500 mb-6">Confirming lived experience you share.</p>
      <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
        <VouchInner />
      </Suspense>
    </main>
  )
}
