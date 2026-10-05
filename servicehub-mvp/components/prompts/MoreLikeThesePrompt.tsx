'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { saveProfile, useMyProfile } from '@/lib/useMyProfile'
import { needsForCategory, type SetupNeed } from '@/lib/onboarding/setup'
import { firstTime, track } from '@/lib/track'

/**
 * "Want more like these?", after someone has saved three or more places of
 * one kind that what they are looking for does not cover yet (Riipen Labs,
 * Group 8: "prompting for a new topic only after a user saves several
 * resources in that category"). Adding it changes "For you" on the home
 * page. "Not now" is remembered for that kind of place in this browser.
 */

const ENOUGH = 3

export default function MoreLikeThesePrompt() {
  const { profile, setProfile } = useMyProfile()
  const [declined, setDeclined] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<SetupNeed | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      setDeclined(new Set(JSON.parse(localStorage.getItem('rh_more_no') || '[]')))
    } catch {}
  }, [])

  // The kind of place saved most, with a need not yet chosen.
  let offer: { category: string; count: number; need: SetupNeed } | null = null
  if (profile?.signedIn && profile.saved) {
    const chosen = new Set(profile.needs || [])
    const counts = Object.entries(profile.saved.byCategory).sort((a, b) => b[1] - a[1])
    for (const [category, count] of counts) {
      if (count < ENOUGH) break
      const need = needsForCategory(category).find((n) => !chosen.has(n.id) && !declined.has(n.id))
      if (need) {
        offer = { category, count, need }
        break
      }
    }
  }

  const offerId = offer?.need.id
  useEffect(() => {
    if (offerId && firstTime(`rh_prompt_shown.more_like_these.${offerId}`)) track('rh_prompt', 'shown.more_like_these')
  }, [offerId])

  if (added) {
    return (
      <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900" role="status">
        Added {added.label.toLowerCase()} to what you are looking for.{' '}
        <Link href="/" className="font-medium underline">
          See places for you
        </Link>
      </div>
    )
  }
  if (!offer) return null
  const { category, count, need } = offer

  async function add() {
    setBusy(true)
    const { profile: next } = await saveProfile('/api/me/profile', {
      method: 'PATCH',
      body: JSON.stringify({ needs: [...(profile?.needs || []), need.id] }),
    })
    setBusy(false)
    if (!next) return
    track('rh_prompt', 'yes.more_like_these')
    setAdded(need)
    setProfile((prev) => ({ ...(prev || { signedIn: true }), ...next }))
  }

  function notNow() {
    const next = new Set(declined)
    next.add(need.id)
    try {
      localStorage.setItem('rh_more_no', JSON.stringify(Array.from(next)))
    } catch {}
    track('rh_prompt', 'no.more_like_these')
    setDeclined(next)
  }

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm" aria-labelledby="more-like-these-heading">
      <h2 id="more-like-these-heading" className="text-base font-semibold text-gray-900">
        Want more like these?
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        You&apos;ve saved {count} places in &ldquo;{category}&rdquo;. Add {need.label.toLowerCase()} to what
        you are looking for, and more like them will show on your home page.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={notNow}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {busy ? 'Adding...' : `Add ${need.label.toLowerCase()}`}
        </button>
      </div>
    </section>
  )
}
