'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const ROLES = [
  { id: 'clinician', label: 'Clinician (doctor, psychologist, therapist)' },
  { id: 'support_worker', label: 'Support worker / case worker' },
  { id: 'educator', label: 'Educator / school support staff' },
]

const NORM_LABELS: Record<string, string> = {
  autism: 'Autism', adhd: 'ADHD', ocd: 'OCD', bipolar: 'Bipolar Disorder',
  sensory_deaf: 'Deaf or Hard of Hearing', sensory_blind: 'Blind or Low Vision',
  physical_wheelchair: 'Wheelchair User', physical_mobility: 'Mobility Challenges',
  intellectual: 'Intellectual Disabilities', chronic_health: 'Chronic Health Conditions',
  mental_health: 'Mental Health Considerations',
}
const normLabel = (t: string) =>
  NORM_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')

export default function VerifyPage({ params }: { params: { token: string } }) {
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'done'>('loading')
  const [info, setInfo] = useState<{ name: string; barrierType: string } | null>(null)
  const [role, setRole] = useState('')
  const [attested, setAttested] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/verification/${params.token}`, { cache: 'no-store' })
      .then(async (r) => (r.ok ? { ok: true, j: await r.json() } : { ok: false, j: null }))
      .then(({ ok, j }) => {
        if (ok && j) { setInfo(j); setState('ready') } else setState('gone')
      })
      .catch(() => setState('gone'))
  }, [params.token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!role) return setError('Please select your role.')
    if (!attested) return setError('Please confirm the statement to continue.')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/verification/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verifierType: role, attested: true }),
      })
      if (res.ok) setState('done')
      else {
        const j = await res.json().catch(() => null)
        setError(j?.error === 'already_used' ? 'This link has already been used.' : (j?.error || 'Could not submit.'))
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="w-6 h-6 text-emerald-600" aria-hidden="true" />
          <h1 className="text-xl font-bold text-gray-900">Confirm a norm</h1>
        </div>

        {state === 'loading' && (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking this link…
          </div>
        )}

        {state === 'gone' && (
          <div className="text-center py-6">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" aria-hidden="true" />
            <p className="font-medium text-gray-900 mb-1">This link isn&apos;t usable</p>
            <p className="text-sm text-gray-600">
              It may have expired, already been used, or been replaced by a newer one.
              Ask the person to send you a fresh link.
            </p>
          </div>
        )}

        {state === 'done' && (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" aria-hidden="true" />
            <p className="font-medium text-gray-900 mb-1">Thank you — confirmed</p>
            <p className="text-sm text-gray-600">
              We recorded only that a professional confirmed this, the date, and your role.
              You can close this page.
            </p>
          </div>
        )}

        {state === 'ready' && info && (
          <form onSubmit={submit} className="space-y-5">
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <p className="text-sm text-gray-700">
                <strong>{info.name}</strong> has asked you to confirm that they identify with:
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">{normLabel(info.barrierType)}</p>
            </div>

            {/* Be explicit about what is and isn't collected. */}
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900">
              <p className="font-semibold mb-1">We are not collecting medical records.</p>
              <p>
                Do <strong>not</strong> upload or send any documents, diagnoses, or clinical notes —
                there is no way to attach them here, by design. We store only that a professional
                confirmed this, the date, and your role. We do not store your name or credentials.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Your role</label>
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value={r.id}
                      checked={role === r.id}
                      onChange={() => setRole(r.id)}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={attested}
                onChange={(e) => setAttested(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500 rounded"
              />
              <span className="text-sm text-gray-700">
                I confirm I have a professional relationship with this person, and that to the best
                of my knowledge this norm is accurate.
              </span>
            </label>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-medium"
            >
              {submitting ? 'Submitting…' : 'Confirm'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
