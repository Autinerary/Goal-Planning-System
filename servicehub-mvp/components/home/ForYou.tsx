'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Compass } from 'lucide-react'
import MatchedPlaceCard, { nearbyNote } from '@/components/onboarding/MatchedPlaceCard'
import { saveProfile, useMyProfile, type MyProfileResponse } from '@/lib/useMyProfile'
import { MORE_ABOUT_YOU, findNeed } from '@/lib/onboarding/setup'
import type { MatchedPlace } from '@/lib/onboarding/first'
import { firstTime, track } from '@/lib/track'

/**
 * The top of the home page for someone signed in: "Welcome back" when it is
 * time to ask for more, and places matched to their topic and what they hope
 * to find (Riipen Labs, Group 8: setup's answers should visibly lead
 * somewhere, and more can be asked "only when behaviour shows it is useful,
 * such as ... returning after 7+ days").
 */

const DAY_MS = 24 * 60 * 60 * 1000
const MORE_GROUPS = new Set(MORE_ABOUT_YOU.map((g) => g.group))

/** A week since joining, nothing in "More about you", and not declined. */
function sharpenDue(p: MyProfileResponse): boolean {
  if (!p.signedIn || !p.createdAt) return false
  if (Date.now() - new Date(p.createdAt).getTime() < 7 * DAY_MS) return false
  if ((p.norms || []).some((n) => MORE_GROUPS.has(n.group))) return false
  if (p.sharpen === 'no') return false
  if (p.sharpen && p.sharpen > new Date().toISOString().slice(0, 10)) return false
  return true
}

function SharpenPrompt({ profile, onAnswer }: { profile: MyProfileResponse; onAnswer: (p: MyProfileResponse) => void }) {
  useEffect(() => {
    if (firstTime('rh_prompt_shown.sharpen')) track('rh_prompt', 'shown.sharpen')
  }, [])

  async function answer(sharpen: 'no' | 'later') {
    track('rh_prompt', `${sharpen === 'no' ? 'no' : 'later'}.sharpen`)
    const { profile: next } = await saveProfile('/api/me/profile', { method: 'PATCH', body: JSON.stringify({ sharpen }) })
    onAnswer({ ...profile, ...(next || {}), sharpen: next?.sharpen ?? sharpen })
  }

  const saved = profile.saved?.total || 0
  return (
    <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="sharpen-heading">
      <p className="text-sm font-semibold text-gray-500">Welcome back</p>
      {saved > 0 && (
        <p className="mt-2 text-gray-800">
          <span className="text-2xl font-bold text-blue-700">{saved}</span>{' '}
          {saved === 1 ? 'place saved' : 'places saved'}
        </p>
      )}
      <h2 id="sharpen-heading" className="mt-3 text-lg font-semibold text-gray-900">
        Take two minutes to sharpen your matches?
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Totally optional. Say no thanks and it won&apos;t come up again.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => answer('later')}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Maybe later
        </button>
        <button
          type="button"
          onClick={() => answer('no')}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          No thanks
        </button>
        <Link
          href="/profile#more"
          onClick={() => track('rh_prompt', 'yes.sharpen')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Sure, let&apos;s go
        </Link>
      </div>
    </section>
  )
}

interface Matches {
  places: MatchedPlace[]
  topic: { id: string; label: string } | null
  needs: string[]
  place: string | null
}

export default function ForYou() {
  const { profile, setProfile } = useMyProfile()
  const [matches, setMatches] = useState<Matches | null>(null)

  const hasAnswers = Boolean(profile?.signedIn && ((profile.norms || []).length > 0 || (profile.needs || []).length > 0))

  useEffect(() => {
    if (!hasAnswers) return
    let live = true
    fetch('/api/onboarding/first?limit=6', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (live) setMatches(data || { places: [], topic: null, needs: [], place: null })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [hasAnswers])

  if (!profile?.signedIn) return null

  const about = [matches?.topic?.label, ...(matches?.needs || []).map((id) => findNeed(id)?.label)].filter(Boolean)

  return (
    <>
      {sharpenDue(profile) && <SharpenPrompt profile={profile} onAnswer={setProfile} />}

      {!hasAnswers ? (
        <section className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5" aria-label="For you">
          <p className="flex items-center gap-2 text-sm text-blue-900">
            <Compass className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            Add a topic, or what you are looking for, and places matched to you will show here.
          </p>
          <Link
            href="/profile"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-700 border border-blue-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add to your profile
          </Link>
        </section>
      ) : (
        <section className="mb-12" aria-labelledby="for-you-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="for-you-heading" className="text-2xl font-bold text-gray-900">
                For you
              </h2>
              {matches && (
                <p className="mt-1 text-sm text-gray-600">
                  {about.length > 0 ? `Matched to ${about.join(' · ')}` : 'Matched to your profile'}
                  {nearbyNote(matches.places, matches.place)}.
                </p>
              )}
            </div>
            <Link href="/profile" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Change what you see
            </Link>
          </div>
          {!matches ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : matches.places.length === 0 ? (
            <p className="rounded-xl bg-white p-5 text-sm text-gray-600 shadow-sm">
              Nothing matches yet. Try <Link href="/search" className="underline">searching ResourceHub</Link>.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matches.places.map((place) => (
                <MatchedPlaceCard key={place.id} place={place} topicLabel={matches.topic?.label} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}
