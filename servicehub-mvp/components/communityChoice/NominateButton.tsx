'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { appSignInHref, APP_URL } from '@/lib/appSignIn'
import { monthName } from '@/lib/communityChoice'
import CommunityChoiceBadge, { choiceMonthLabel } from './CommunityChoiceBadge'

/**
 * "Nominate for Community's Choice" on a service, a shop item or an article
 * (the team's planning note, October 2026, Goal 5), and its badge when it has
 * won. Nominations run all month; the vote is in the newsletter in the
 * month's last week.
 */
export default function NominateButton({ itemId, itemName, signedIn }: { itemId: string; itemName: string; signedIn: boolean }) {
  const [state, setState] = useState<{ open: boolean; month?: string; nominated?: boolean; won?: string[] }>({ open: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetch(`/api/community-choice?item=${itemId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setState(d))
      .catch(() => {})
  }, [itemId])

  const toggle = async () => {
    if (!signedIn) {
      window.location.href = appSignInHref(window.location.pathname)
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/community-choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, on: !state.nominated }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error || 'Could not save that.')
      setState((s) => ({ ...s, nominated: Boolean(d.nominated) }))
      setStatus(d.nominated ? `${itemName} is nominated.` : 'Your nomination is taken back.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  if (!state.open) return null
  const month = state.month ? monthName(state.month) : 'this month'
  return (
    <div className="space-y-2">
      {state.won && state.won.length > 0 && (
        <p className="flex flex-wrap items-center gap-2">
          <CommunityChoiceBadge size="md" month={choiceMonthLabel(state.won[0])} />
          {state.won.length > 1 && <span className="text-sm text-gray-700">Also chosen in {state.won.slice(1).map(choiceMonthLabel).join(', ')}.</span>}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={Boolean(state.nominated)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-60 ${
            state.nominated ? 'border-amber-500 bg-amber-100 text-amber-950' : 'border-gray-300 bg-white text-gray-900 hover:bg-amber-50'
          }`}
        >
          <Trophy className="h-4 w-4" aria-hidden="true" />
          {state.nominated ? `Nominated for ${month}'s Community's Choice` : "Nominate for Community's Choice"}
        </button>
        {state.nominated && (
          <button type="button" onClick={toggle} disabled={busy} className="text-sm font-medium text-gray-800 underline">
            Take it back
          </button>
        )}
        <a href={`${APP_URL}/community-choice`} className="text-sm font-medium text-blue-800 underline">
          How it works
        </a>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
