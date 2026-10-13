'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { backendAuthHeaders } from '@/lib/backendAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** Off unless NEXT_PUBLIC_ADAPTATION_OFFERS_ENABLED is 'true' (and the backend's ADAPTATION_OFFERS_ENABLED). */
export const ADAPTATION_OFFERS_ENABLED = process.env.NEXT_PUBLIC_ADAPTATION_OFFERS_ENABLED === 'true'

type Offer = { id: string; rule: string; milestone_id: string; milestone_name: string; text: string; reason: string }
type OfferState = 'saving' | 'accepted' | 'dismissed' | 'error'
type Ask = { id: string; ask: 'first' | 'second'; milestone_id: string; milestone_name: string; text: string }

/**
 * "Did that help?", yes or no, for an accepted change (STEP 74): asked once
 * after Accept, and once more on the first visit at least 7 days later. The
 * backend works out which question is due; nothing is scheduled.
 */
function Helped({ id, pathId, question }: { id: string; pathId: string; question: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'thanks' | 'error'>('idle')
  const send = async (answer: 'yes' | 'no') => {
    setState('saving')
    try {
      const res = await fetch(`${API_URL}/api/adaptations/${encodeURIComponent(id)}/helped`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await backendAuthHeaders()) },
        body: JSON.stringify({ pathId, answer }),
      })
      setState(res.ok ? 'thanks' : 'error')
    } catch {
      setState('error')
    }
  }
  if (state === 'thanks') return <p role="status" className="mt-3 text-sm font-medium text-emerald-800">Thank you.</p>
  const questionId = `helped-${id}`
  return (
    <div className="mt-3">
      <p id={questionId} className="text-sm font-semibold text-slate-900">{question}</p>
      <div role="group" aria-labelledby={questionId} className="mt-2 flex gap-2">
        {(['yes', 'no'] as const).map((answer) => (
          <button
            key={answer}
            type="button"
            disabled={state === 'saving'}
            onClick={() => send(answer)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60"
          >
            {answer === 'yes' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
      {state === 'error' && <p role="status" className="mt-2 text-sm text-slate-800">This could not be saved just now. Please try again.</p>}
    </div>
  )
}

/**
 * "Suggested change" cards on the Path, under "Your next step": each names
 * one step and one change to it (Adaptation, backend api/routes/adaptations.py,
 * STEP 73). Accept changes the plan; Not now leaves it as it is, and the
 * suggestion isn't made again. Nothing changes without Accept. Renders
 * nothing unless the flag is on and the backend can record offers.
 */
export default function SuggestedChanges({ pathId, onChanged }: { pathId?: string; onChanged?: () => void }) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [asks, setAsks] = useState<Ask[]>([])
  const [states, setStates] = useState<Record<string, OfferState>>({})

  useEffect(() => {
    if (!ADAPTATION_OFFERS_ENABLED || !pathId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/adaptations/${encodeURIComponent(pathId)}`, {
          cache: 'no-store',
          headers: await backendAuthHeaders(),
        })
        const json = res.ok ? await res.json() : null
        if (!cancelled && json?.available && Array.isArray(json.offers)) {
          setOffers(json.offers)
          setAsks(Array.isArray(json.asks) ? json.asks : [])
        }
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [pathId])

  if (!ADAPTATION_OFFERS_ENABLED || !pathId || (offers.length === 0 && asks.length === 0)) return null

  const answer = async (offer: Offer, response: 'accept' | 'not_now') => {
    setStates((s) => ({ ...s, [offer.id]: 'saving' }))
    try {
      const res = await fetch(`${API_URL}/api/adaptations/${encodeURIComponent(offer.id)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await backendAuthHeaders()) },
        body: JSON.stringify({ pathId, response }),
      })
      const json = res.ok ? await res.json() : null
      if (json?.answered) {
        setStates((s) => ({ ...s, [offer.id]: json.accepted ? 'accepted' : 'dismissed' }))
        if (json.accepted) onChanged?.()
      } else {
        setStates((s) => ({ ...s, [offer.id]: 'error' }))
      }
    } catch {
      setStates((s) => ({ ...s, [offer.id]: 'error' }))
    }
  }

  return (
    <section aria-labelledby="suggested-changes-heading" className="mb-6 space-y-3">
      <h2 id="suggested-changes-heading" className="sr-only">Suggested changes to your plan</h2>
      {offers.map((offer) => {
        const state = states[offer.id]
        const headingId = `suggested-change-${offer.id}`
        return (
          <article key={offer.id} aria-labelledby={headingId} className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <h3 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-amber-900">Suggested change</h3>
            <p className="mt-1 text-sm text-slate-800">
              For{' '}
              <Link href={`/milestones/${encodeURIComponent(offer.milestone_id)}`} className="font-semibold text-slate-900 underline underline-offset-2">
                {offer.milestone_name}
              </Link>
            </p>
            <p className="mt-2 text-base text-slate-900">{offer.text}</p>
            <p className="mt-1 text-sm text-slate-700">{offer.reason}</p>
            {state === 'accepted' ? (
              <>
                <p role="status" className="mt-3 text-sm font-medium text-emerald-800">Done. Your plan has changed.</p>
                <Helped id={offer.id} pathId={pathId} question="Did that help?" />
              </>
            ) : state === 'dismissed' ? (
              <p role="status" className="mt-3 text-sm text-slate-800">Okay. Your plan stays as it is, and this won’t be suggested again.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={state === 'saving'}
                  onClick={() => answer(offer, 'accept')}
                  className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={state === 'saving'}
                  onClick={() => answer(offer, 'not_now')}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60"
                >
                  Not now
                </button>
              </div>
            )}
            {state === 'error' && (
              <p role="status" className="mt-2 text-sm text-slate-800">This could not be saved just now. Please try again.</p>
            )}
          </article>
        )
      })}
      {asks.map((ask) => {
        const headingId = `accepted-change-${ask.id}`
        return (
          <article key={ask.id} aria-labelledby={headingId} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-emerald-900">A change you accepted</h3>
            <p className="mt-1 text-sm text-slate-800">
              {ask.ask === 'second' ? 'A week ago you accepted this change for ' : 'For '}
              <Link href={`/milestones/${encodeURIComponent(ask.milestone_id)}`} className="font-semibold text-slate-900 underline underline-offset-2">
                {ask.milestone_name}
              </Link>
              {ask.ask === 'second' ? '.' : ''}
            </p>
            {ask.text && <p className="mt-2 text-base text-slate-900">{ask.text}</p>}
            <Helped id={ask.id} pathId={pathId} question={ask.ask === 'second' ? 'Did it help?' : 'Did that help?'} />
          </article>
        )
      })}
    </section>
  )
}
