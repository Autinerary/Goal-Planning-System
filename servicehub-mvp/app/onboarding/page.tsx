'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import RoleSelector from '@/components/onboarding/RoleSelector'
import MatchedPlaceCard, { nearbyNote } from '@/components/onboarding/MatchedPlaceCard'
import SetLocationPrompt from '@/components/resources/SetLocationPrompt'
import { useMyProfile } from '@/lib/useMyProfile'
import {
  MAX_SETUP_NEEDS,
  SETUP_NEEDS,
  SETUP_STEPS,
  TOPIC_CHOICES,
  findNeed,
  findNorm,
  findRole,
  isOtherNorm,
  normsMatching,
  searchHref,
} from '@/lib/onboarding/setup'
import type { MatchedPlace } from '@/lib/onboarding/first'
import { track } from '@/lib/track'

/**
 * ResourceHub setup: who you are, one topic and what you hope to find, then
 * a first place to start (Riipen Labs, Group 8). It was five steps (Welcome,
 * Location, Norms, Impact, Context) before anything useful appeared. Location,
 * identity, health and more topics are asked later, where they are used:
 * the home page, search and the profile (lib/onboarding/setup.ts).
 */

interface FirstPlaces {
  places: MatchedPlace[]
  topic: { id: string; label: string } | null
  needs: string[]
  place: string | null
}

const chip = (on: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
    on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-blue-400'
  }`

export default function OnboardingPage() {
  const { profile } = useMyProfile()
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<string | null>(null)
  const [topic, setTopic] = useState<string | null>(null)
  const [topicNote, setTopicNote] = useState('')
  const [topicQuery, setTopicQuery] = useState('')
  const [needs, setNeeds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [first, setFirst] = useState<FirstPlaces | null>(null)
  const [prefilled, setPrefilled] = useState(false)
  const [locating, setLocating] = useState(false)

  // Someone setting up again starts from their answers.
  useEffect(() => {
    if (prefilled || !profile?.signedIn) return
    setPrefilled(true)
    if (profile.role && findRole(profile.role)) setRole(profile.role)
    if (profile.needs?.length) setNeeds(profile.needs.slice(0, MAX_SETUP_NEEDS))
    const known = (profile.norms || []).find((n) => n.group === 'neurodivergence' && findNorm(n.type))
    if (known) setTopic(known.type)
  }, [profile, prefilled])

  useEffect(() => {
    track('rh_setup_step', SETUP_STEPS[step])
  }, [step])

  const forSomeoneElse = Boolean(findRole(role)?.forSomeoneElse)
  const topicChoices = topicQuery.trim() ? normsMatching(topicQuery).slice(0, 10) : TOPIC_CHOICES
  const chosenTopic = findNorm(topic)

  function toggleNeed(id: string) {
    setNeeds((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : prev.length >= MAX_SETUP_NEEDS ? [...prev.slice(1), id] : [...prev, id]
    )
  }

  async function loadFirst() {
    setFirst(null)
    try {
      const found = await fetch('/api/onboarding/first?limit=3', { credentials: 'include', cache: 'no-store' })
      setFirst(found.ok ? await found.json() : { places: [], topic: null, needs: [], place: null })
    } catch {
      setFirst({ places: [], topic: null, needs: [], place: null })
    }
  }

  async function save(skip: boolean) {
    if (!role) return
    setSaving(true)
    setError(null)
    const body = skip ? { role } : { role, topic, topicNote, needs }
    try {
      const res = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not save that. Please try again.')
        return
      }
      track('rh_setup_complete', !skip && topic ? 'topic' : 'no_topic')
      setStep(2)
      await loadFirst()
    } catch {
      setError('Could not reach ResourceHub. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const firstNeed = first?.needs?.length ? findNeed(first.needs[0]) : undefined
  const moreHref = firstNeed
    ? searchHref(firstNeed.searches[0])
    : first?.topic
    ? searchHref({ conditions: first.topic.id })
    : '/search'

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <main id="main-content" className="mx-auto max-w-xl">
        {/* Step 1 of 3, as a short bar per step */}
        <div className="mb-6">
          <div className="flex gap-2" aria-hidden="true">
            {SETUP_STEPS.map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500" aria-live="polite">
            Step {step + 1} of {SETUP_STEPS.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Welcome to ResourceHub</h1>
                <p className="mt-2 text-gray-600">Tell us who you are, so we can start you off in the right place.</p>
              </div>
              <RoleSelector selectedRole={role} onSelectRole={setRole} />
              <p className="text-sm text-gray-600">
                ResourceHub is places and services rated by people with similar experiences. It is not a clinical
                directory, and not medical advice.
              </p>
              <p className="text-xs text-gray-500">
                We don&apos;t sell your information, show ads, or use it to train AI.{' '}
                <a href="/privacy" className="underline">
                  Privacy
                </a>
              </p>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={!role}
                className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">What would you like resources for?</h1>
                <p className="mt-2 text-gray-600">
                  {forSomeoneElse
                    ? 'Pick what the person you support navigates. Your matches are about them. '
                    : 'Pick one to start. '}
                  You can add more anytime from your profile.
                </p>
              </div>

              <div>
                <label htmlFor="topic-search" className="block text-sm font-semibold text-gray-900">
                  Search
                </label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="topic-search"
                    type="search"
                    value={topicQuery}
                    onChange={(e) => setTopicQuery(e.target.value)}
                    placeholder="For example, ADHD or hearing"
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Topic">
                  {topicChoices.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      role="radio"
                      aria-checked={topic === n.id}
                      onClick={() => setTopic(topic === n.id ? null : n.id)}
                      className={chip(topic === n.id)}
                    >
                      {isOtherNorm(n.id) ? 'Other' : n.label}
                    </button>
                  ))}
                  {topicChoices.length === 0 && (
                    <p className="text-sm text-gray-600">
                      Nothing by that name yet. Try another word, or pick Other.
                    </p>
                  )}
                  {chosenTopic && !topicChoices.some((n) => n.id === chosenTopic.id) && (
                    <button type="button" role="radio" aria-checked onClick={() => setTopic(null)} className={chip(true)}>
                      {chosenTopic.label}
                    </button>
                  )}
                </div>
                {chosenTopic && isOtherNorm(chosenTopic.id) && (
                  <div className="mt-3">
                    <label htmlFor="topic-note" className="block text-sm text-gray-700">
                      What is it? (optional)
                    </label>
                    <input
                      id="topic-note"
                      value={topicNote}
                      onChange={(e) => setTopicNote(e.target.value)}
                      maxLength={200}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-900">What are you hoping to find right now? Pick 1–2.</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {SETUP_NEEDS.map((n) => {
                    const on = needs.includes(n.id)
                    return (
                      <button
                        key={n.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleNeed(n.id)}
                        className={`rounded-xl border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          on ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <span className="block font-medium text-gray-900">{n.label}</span>
                        <span className="mt-0.5 block text-sm text-gray-600">{n.hint}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => save(false)}
                  disabled={saving || (!topic && needs.length === 0)}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Continue'}
                </button>
                <button
                  type="button"
                  onClick={() => save(true)}
                  disabled={saving}
                  className="text-sm font-medium text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  Skip this step
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Here&apos;s a place to start</h1>
                <p className="mt-2 text-gray-600">
                  {first?.places.length
                    ? `Matched to what you told us${nearbyNote(first.places, first.place)}.`
                    : first
                    ? "We couldn't find a close match yet. Everything in ResourceHub is a search away."
                    : 'Finding places for you...'}
                </p>
              </div>

              {/* Location is not a setup question, but this is where it pays
                  off: offered, in one line, and only if wanted (Group 8). */}
              {first && !first.place && (
                locating ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="mb-3 text-sm text-blue-900">
                      Your location is private and optional. We use it to show places near you first.
                    </p>
                    <SetLocationPrompt
                      bare
                      onSaved={() => {
                        setLocating(false)
                        loadFirst()
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    Want places near you first?{' '}
                    <button type="button" onClick={() => setLocating(true)} className="font-medium text-blue-700 underline">
                      Add your location
                    </button>{' '}
                    (optional).
                  </p>
                )
              )}

              {!first && (
                <div className="space-y-3" aria-hidden="true">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
                  ))}
                </div>
              )}
              {first?.places.map((place) => (
                <MatchedPlaceCard key={place.id} place={place} topicLabel={first.topic?.label} fromSetup />
              ))}

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/"
                  className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Go to ResourceHub
                </Link>
                {first && (
                  <Link href={moreHref} className="text-sm font-medium text-blue-700 underline">
                    {firstNeed ? `See more: ${firstNeed.label.toLowerCase()}` : 'Search ResourceHub'}
                  </Link>
                )}
              </div>
              <p className="text-sm text-gray-600">
                You can add more about yourself anytime from{' '}
                <Link href="/profile" className="underline">
                  your profile
                </Link>
                . Nothing else is needed right now.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
