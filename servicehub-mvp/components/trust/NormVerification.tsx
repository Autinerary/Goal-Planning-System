'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Copy, Check, Loader2 } from 'lucide-react'
import { TRUST_META, VERIFICATION_META, type RaterTrust, type VerificationMethod } from '@/lib/trust'

interface Norm {
  type: string
  severity: number
  method: VerificationMethod
}

const NORM_LABELS: Record<string, string> = {
  autism: 'Autism', adhd: 'ADHD', ocd: 'OCD', bipolar: 'Bipolar Disorder',
  sensory_deaf: 'Deaf or Hard of Hearing', sensory_blind: 'Blind or Low Vision',
  physical_wheelchair: 'Wheelchair User', physical_mobility: 'Mobility Challenges',
  intellectual: 'Intellectual Disabilities', chronic_health: 'Chronic Health Conditions',
  mental_health: 'Mental Health Considerations',
}
const normLabel = (t: string) =>
  NORM_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')

/**
 * Lets someone request a one-time professional attestation link for a norm,
 * and shows their earned rater trust. Verification is entirely optional —
 * self-identified norms are valid and never treated as lesser.
 */
export default function NormVerification() {
  const [norms, setNorms] = useState<Norm[]>([])
  const [trust, setTrust] = useState<RaterTrust | null>(null)
  const [loading, setLoading] = useState(true)
  const [link, setLink] = useState<{ url: string; forNorm: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    fetch('/api/me/trust', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (Array.isArray(j?.norms)) setNorms(j.norms)
        if (j?.trust) setTrust(j.trust)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const requestLink = async (barrierType: string) => {
    setBusy(barrierType); setError(''); setCopied(false)
    try {
      const res = await fetch('/api/verification/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ barrierType }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) setError(j?.error || 'Could not create a link.')
      else setLink({ url: j.url, forNorm: barrierType })
    } catch {
      setError('Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-600" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-gray-900">Your norms &amp; trust</h3>
      </div>

      {trust && (
        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${TRUST_META[trust.tier].className}`}>
          {TRUST_META[trust.tier].label}
          {trust.ratingsCount > 0 ? ` · ${trust.ratingsCount} ratings` : ''}
        </span>
      )}

      <p className="text-xs text-gray-500">
        Self-identified norms are valid — assessment is expensive and hard to access, and we never
        ask for diagnosis paperwork. Optionally, a clinician or support worker can confirm a norm
        via a one-time link. We record only that it happened, the date, and their role.
      </p>

      {norms.length === 0 ? (
        <p className="text-sm text-gray-500">No norms on your profile yet.</p>
      ) : (
        <ul className="space-y-2">
          {norms.map((n) => {
            const vm = VERIFICATION_META[n.method] || VERIFICATION_META.self
            return (
              <li key={n.type} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{normLabel(n.type)}</div>
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${vm.className}`} title={vm.description}>
                    {vm.label}
                  </span>
                </div>
                {n.method !== 'professional' && (
                  <button
                    onClick={() => requestLink(n.type)}
                    disabled={busy === n.type}
                    className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {busy === n.type ? 'Creating…' : 'Get verification link'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {link && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs text-emerald-900 mb-2">
            Send this one-time link to your clinician or support worker for{' '}
            <strong>{normLabel(link.forNorm)}</strong>. It expires in 14 days and works once.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-emerald-300 bg-white text-gray-700"
            />
            <button
              onClick={() => {
                navigator.clipboard?.writeText(link.url).then(
                  () => { setCopied(true); setTimeout(() => setCopied(false), 2000) },
                  () => {}
                )
              }}
              className="flex-shrink-0 p-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-white"
              aria-label="Copy link"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
