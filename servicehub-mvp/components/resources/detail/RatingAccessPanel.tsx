'use client'

import { useState } from 'react'
import { CheckCircle2, Mail, Users } from 'lucide-react'
import { nextMeeting } from '@/lib/team'
import { PROOF_EMAIL, RATING_RULE, proofMailto, type RatingAccess } from '@/lib/ratings/access'

/**
 * Why someone cannot rate a service yet, and the three ways they can (the
 * team's planning note, October 2026, Goal 5): add it to their team, have
 * recommended it, or show they used it before joining (a code, and the proof
 * by email to heydevs@autinerary.ca, which an admin checks). Comments stay
 * open to everyone.
 */
export default function RatingAccessPanel({
  resourceId,
  resourceName,
  access,
  onCanRate,
}: {
  resourceId: string
  resourceName?: string
  access: RatingAccess
  onCanRate: () => void
}) {
  const name = resourceName || 'this service'
  const [claim, setClaim] = useState(access.claim)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [teamAdded, setTeamAdded] = useState(false)

  const addToTeam = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId, meeting: nextMeeting() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not add it to your team.')
      setTeamAdded(true)
      onCanRate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add it to your team.')
    } finally {
      setBusy(false)
    }
  }

  const usedBefore = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/resources/${resourceId}/prior-use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not save that.')
      setClaim({ code: data.code, status: data.status, created_at: new Date().toISOString() })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 p-6 text-gray-900">
      <div>
        <h3 className="text-lg font-semibold">Ratings come from people who have used a service</h3>
        <p className="mt-1 text-sm text-gray-800">{RATING_RULE}</p>
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="way-team" className="rounded-lg border border-gray-200 p-4">
        <h4 id="way-team" className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-blue-800" aria-hidden="true" /> 1. It is in your team
        </h4>
        <p className="mt-1 text-sm text-gray-800">
          {access.wishlist
            ? `${name} is in your wishlist. Add it to your team, with a first meeting to arrange, and you can rate it.`
            : `Add ${name} to your team, with a first meeting to arrange, and you can rate it.`}
        </p>
        {!teamAdded && (
          <button
            type="button"
            onClick={addToTeam}
            disabled={busy}
            className="mt-2 rounded-lg border-2 border-blue-700 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
          >
            Add to my team
          </button>
        )}
      </section>

      <section aria-labelledby="way-recommended" className="rounded-lg border border-gray-200 p-4">
        <h4 id="way-recommended" className="font-semibold">
          2. You recommended it
        </h4>
        <p className="mt-1 text-sm text-gray-800">
          If you added {name} to ResourceHub with <span className="font-medium">Recommend</span>, you can rate it.
        </p>
      </section>

      {!access.wishlist && (
        <section aria-labelledby="way-before" className="rounded-lg border border-gray-200 p-4">
          <h4 id="way-before" className="font-semibold">
            3. You used it before you joined
          </h4>
          {claim?.status === 'pending' ? (
            <div className="mt-1 space-y-2 text-sm text-gray-800">
              <p>
                Your code is <span className="font-mono font-semibold">{claim.code}</span>. Email your proof to{' '}
                <span className="font-medium">{PROOF_EMAIL}</span> with the code: for example a receipt, an invoice, an
                appointment confirmation, or a letter or report from them. Cover anything you do not want to share; we only
                need to see that it was you and {name}.
              </p>
              <a
                href={proofMailto(name, claim.code)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800"
              >
                <Mail className="h-4 w-4" aria-hidden="true" /> Email the proof
              </a>
              <p className="text-xs text-gray-700">
                Once we have checked it, you can rate {name}. We use your proof only to check, and delete the email once we have.
              </p>
            </div>
          ) : claim?.status === 'rejected' ? (
            <p className="mt-1 text-sm text-gray-800">
              We could not confirm it from the proof we had (code {claim.code}). You can send more to {PROOF_EMAIL}.
            </p>
          ) : claim?.status === 'approved' ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-900">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Confirmed: you can rate {name}.
            </p>
          ) : (
            <div className="mt-1 space-y-2 text-sm text-gray-800">
              <p>Tell us, and we will give you a code to send with your proof.</p>
              <label className="block">
                <span className="mb-1 block font-medium text-gray-900">
                  When did you use it? <span className="font-normal text-gray-700">(optional)</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
              <button
                type="button"
                onClick={usedBefore}
                disabled={busy}
                className="rounded-lg border-2 border-blue-700 px-3 py-1.5 font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
              >
                I used it before I joined
              </button>
            </div>
          )}
        </section>
      )}

      <p className="text-sm text-gray-800">Anyone can comment on a service at any time: the comments are on its page.</p>
    </div>
  )
}
