'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { saveProfile, type MyProfileResponse } from '@/lib/useMyProfile'
import type { NormChoice } from '@/lib/onboarding/setup'
import { firstTime, track } from '@/lib/track'

/**
 * "Add ADHD to your topics?", when someone searches for a topic that is not
 * on their profile (Riipen Labs, Group 8: prompt "only when behaviour shows
 * it is useful, such as ... searching beyond current tags"). "Not now" is
 * remembered for that topic in this browser.
 */
export default function AddTopicPrompt({
  norm,
  profile,
  onSaved,
}: {
  norm: NormChoice
  profile: MyProfileResponse
  onSaved: (next: MyProfileResponse) => void
}) {
  const noKey = `rh_topic_no.${norm.id}`
  const [hidden, setHidden] = useState(true)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasIt = (profile.norms || []).some((n) => n.type === norm.id)

  // A different topic starts afresh.
  useEffect(() => {
    let no = false
    try {
      no = Boolean(localStorage.getItem(noKey))
    } catch {}
    setHidden(no)
    setAdded(false)
    setError(null)
  }, [noKey])

  useEffect(() => {
    if (profile.signedIn && !hidden && !hasIt && firstTime(`rh_prompt_shown.add_topic.${norm.id}`)) {
      track('rh_prompt', 'shown.add_topic')
    }
  }, [profile.signedIn, hidden, hasIt, norm.id])

  if (!profile.signedIn || (hasIt && !added) || hidden) return null

  if (added) {
    return (
      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900" role="status">
        Added. Places rated for {norm.label} now come up in your matches.{' '}
        <Link href="/profile" className="font-medium underline">
          See your profile
        </Link>
      </div>
    )
  }

  async function add() {
    setBusy(true)
    setError(null)
    const { profile: next, error: err } = await saveProfile('/api/me/norms', {
      method: 'POST',
      body: JSON.stringify({ type: norm.id }),
    })
    setBusy(false)
    if (err || !next) {
      setError(err || 'Could not add that. Please try again.')
      return
    }
    track('rh_prompt', 'yes.add_topic')
    setAdded(true)
    onSaved(next)
  }

  function notNow() {
    try {
      localStorage.setItem(noKey, new Date().toISOString())
    } catch {}
    track('rh_prompt', 'no.add_topic')
    setHidden(true)
  }

  return (
    <section className="mb-6 rounded-xl border border-blue-200 bg-white p-5 shadow-sm" aria-labelledby="add-topic-heading">
      <h2 id="add-topic-heading" className="text-base font-semibold text-gray-900">
        Add {norm.label} to your topics?
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        It isn&apos;t one of your topics yet. Adding it means places rated for {norm.label} come up in
        your matches on the home page. You can remove it from your profile anytime.
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Adding...' : 'Add topic'}
        </button>
      </div>
    </section>
  )
}
