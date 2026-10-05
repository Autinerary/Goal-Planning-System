'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, MapPin, Plus, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import NormVerification from '@/components/trust/NormVerification'
import RoleSelector from '@/components/onboarding/RoleSelector'
import SetLocationPrompt from '@/components/resources/SetLocationPrompt'
import { saveProfile, useMyProfile, type MyProfileResponse } from '@/lib/useMyProfile'
import { ALL_NORMS, MORE_ABOUT_YOU, SETUP_NEEDS, findRole, isOtherNorm, normsMatching } from '@/lib/onboarding/setup'

/**
 * Your profile: the basics from setup, and everything else, optional.
 *
 * Riipen Labs, Group 8: identity, health and more topics belong in "a
 * simple 'Add more to your profile' page", which "needs to exist before the
 * fields are removed from onboarding". Setup now asks only who you are, one
 * topic and what you hope to find; this page is where the rest lives, and
 * where any answer can be changed or removed.
 */

const MORE_GROUPS = new Set(MORE_ABOUT_YOU.map((g) => g.group))

const card = 'rounded-2xl bg-white p-6 shadow-sm'
const linkButton =
  'text-sm font-medium text-blue-700 underline hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded'

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { profile, setProfile } = useMyProfile()
  const [editing, setEditing] = useState<'role' | 'location' | 'topic' | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [topicQuery, setTopicQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login?redirect=/profile')
  }, [user, loading, router])

  // Links to #location and #more land on that part, once it has loaded.
  useEffect(() => {
    if (!profile?.signedIn) return
    const hash = window.location.hash.slice(1)
    if (hash === 'location' && !profile.location) setEditing('location')
    if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }), 50)
    // Only when the profile first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.signedIn])

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }
  if (!user) return null

  async function change(key: string, url: string, init: RequestInit) {
    setBusy(key)
    setError(null)
    const { profile: next, error: err } = await saveProfile(url, init)
    setBusy(null)
    if (err || !next) {
      setError(err || 'Could not save that. Please try again.')
      return false
    }
    setProfile((prev) => ({ ...(prev || {}), ...next }) as MyProfileResponse)
    return true
  }

  const norms = profile.norms || []
  const has = (type: string) => norms.some((n) => n.type === type)
  const topics = norms.filter((n) => !MORE_GROUPS.has(n.group))
  const needs = profile.needs || []
  const role = findRole(profile.role)

  const addNorm = (type: string) =>
    change(`norm.${type}`, '/api/me/norms', { method: 'POST', body: JSON.stringify({ type }) })
  const removeNorm = (type: string) =>
    change(`norm.${type}`, `/api/me/norms?type=${encodeURIComponent(type)}`, { method: 'DELETE' })
  const toggleNeed = (id: string) =>
    change(`need.${id}`, '/api/me/profile', {
      method: 'PATCH',
      body: JSON.stringify({ needs: needs.includes(id) ? needs.filter((n) => n !== id) : [...needs, id] }),
    })

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'You'
  const suggestions = topicQuery.trim()
    ? normsMatching(topicQuery).filter((n) => !has(n.id)).slice(0, 8)
    : []

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your profile</h1>
          <p className="mt-2 text-gray-600">
            Everything here is optional. Add what helps, when it helps: we use it to match places to you.
            We don&apos;t sell your information, show ads, or use it to train AI.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <section className={card} aria-labelledby="basics-heading">
          <h2 id="basics-heading" className="text-lg font-semibold text-gray-900">
            Your basics
          </h2>
          <p className="mt-1 text-sm text-gray-600">Set during setup, and used to match places to you.</p>

          <dl className="mt-5 divide-y divide-gray-100">
            {/* Role */}
            <div className="py-4">
              <div className="flex items-start justify-between gap-4">
                <dt className="w-28 flex-shrink-0 text-sm font-semibold text-gray-900">Role</dt>
                <dd className="flex-1 text-sm text-gray-800">{role ? role.label : 'Not chosen yet'}</dd>
                <button type="button" className={linkButton} onClick={() => setEditing(editing === 'role' ? null : 'role')}>
                  {editing === 'role' ? 'Done' : 'Edit'}
                </button>
              </div>
              {editing === 'role' && (
                <div className="mt-3">
                  <RoleSelector
                    compact
                    selectedRole={profile.role || null}
                    onSelectRole={async (id) => {
                      if (await change('role', '/api/me/profile', { method: 'PATCH', body: JSON.stringify({ role: id }) })) {
                        setEditing(null)
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Topics */}
            <div className="py-4">
              <div className="flex items-start justify-between gap-4">
                <dt className="w-28 flex-shrink-0 text-sm font-semibold text-gray-900">Topics</dt>
                <dd className="flex flex-1 flex-wrap gap-2">
                  {topics.length === 0 && <span className="text-sm text-gray-600">None yet</span>}
                  {topics.map((n) => (
                    <span key={n.type} className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1 text-sm font-medium text-blue-800">
                      {n.label}
                      {!n.confirmed && (
                        <button
                          type="button"
                          onClick={() => removeNorm(n.type)}
                          disabled={busy === `norm.${n.type}`}
                          className="rounded-full p-1 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label={`Remove ${n.label}`}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  ))}
                </dd>
                <button type="button" className={linkButton} onClick={() => setEditing(editing === 'topic' ? null : 'topic')}>
                  {editing === 'topic' ? 'Done' : 'Add'}
                </button>
              </div>
              {editing === 'topic' && (
                <div className="mt-3">
                  <label htmlFor="add-topic" className="block text-sm text-gray-700">
                    Find a topic
                  </label>
                  <input
                    id="add-topic"
                    type="search"
                    value={topicQuery}
                    onChange={(e) => setTopicQuery(e.target.value)}
                    placeholder="For example, autism or hearing"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestions.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={async () => {
                          if (await addNorm(n.id)) setTopicQuery('')
                        }}
                        disabled={busy === `norm.${n.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        {n.label}
                      </button>
                    ))}
                    {topicQuery.trim() && suggestions.length === 0 && (
                      <p className="text-sm text-gray-600">Nothing new by that name.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* What they hope to find */}
            <div className="py-4">
              <dt className="text-sm font-semibold text-gray-900">Looking for</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {SETUP_NEEDS.map((n) => {
                  const on = needs.includes(n.id)
                  return (
                    <button
                      key={n.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleNeed(n.id)}
                      disabled={busy === `need.${n.id}`}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-blue-400'
                      }`}
                    >
                      {n.label}
                    </button>
                  )
                })}
              </dd>
            </div>

            {/* Location */}
            <div id="location" className="py-4 scroll-mt-20">
              <div className="flex items-start justify-between gap-4">
                <dt className="w-28 flex-shrink-0 text-sm font-semibold text-gray-900">Location</dt>
                <dd className="flex-1 text-sm text-gray-800">
                  {profile.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-gray-500" aria-hidden="true" />
                      {[profile.location.city, profile.location.province].filter(Boolean).join(', ')}
                    </span>
                  ) : (
                    'Not set'
                  )}
                  <span className="mt-1 block text-gray-600">
                    Used to show places near you first. Private, and optional.
                  </span>
                </dd>
                <button type="button" className={linkButton} onClick={() => setEditing(editing === 'location' ? null : 'location')}>
                  {editing === 'location' ? 'Cancel' : profile.location ? 'Change' : 'Set'}
                </button>
              </div>
              {editing === 'location' && (
                <div className="mt-3">
                  <SetLocationPrompt
                    bare
                    onSaved={async () => {
                      const res = await fetch('/api/me/profile', { cache: 'no-store', credentials: 'include' })
                      if (res.ok) setProfile(await res.json())
                      setEditing(null)
                    }}
                  />
                </div>
              )}
            </div>
          </dl>
        </section>

        <section id="more" className={`${card} scroll-mt-20`} aria-labelledby="more-heading">
          <h2 id="more-heading" className="text-lg font-semibold text-gray-900">
            More about you (optional)
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Adding detail here can sharpen your matches. Nothing here is required, and you can remove anything.
          </p>
          <div className="mt-4 space-y-3">
            {MORE_ABOUT_YOU.map((g) => {
              const options = ALL_NORMS.filter((n) => n.group === g.group && !isOtherNorm(n.id))
              const count = options.filter((n) => has(n.id)).length
              const isOpen = open === g.group
              return (
                <div key={g.group} className="rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : g.group)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start justify-between gap-3 rounded-xl p-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <span>
                      <span className="block font-medium text-gray-900">
                        {g.title}
                        {count > 0 && <span className="ml-2 text-sm font-normal text-blue-700">{count} added</span>}
                      </span>
                      <span className="mt-0.5 block text-sm text-gray-600">{g.hint}</span>
                    </span>
                    <ChevronDown className={`mt-1 h-5 w-5 flex-shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {isOpen && (
                    <div className="grid gap-2 border-t border-gray-100 p-4 sm:grid-cols-2">
                      {options.map((n) => {
                        const confirmed = norms.some((m) => m.type === n.id && m.confirmed)
                        return (
                          <label key={n.id} className="flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={has(n.id)}
                              disabled={busy === `norm.${n.id}` || confirmed}
                              onChange={() => (has(n.id) ? removeNorm(n.id) : addNorm(n.id))}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            {n.label}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className={card} aria-labelledby="account-heading">
          <h2 id="account-heading" className="text-lg font-semibold text-gray-900">
            Account
          </h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-gray-700">Display name</dt>
              <dd className="mt-0.5 text-gray-900">{displayName}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700">Email</dt>
              <dd className="mt-0.5 text-gray-900">{user.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700">User ID</dt>
              <dd className="mt-0.5 font-mono text-xs text-gray-500">{user.id}</dd>
            </div>
          </dl>
        </section>

        {/* Norms, trust tier, and optional professional attestation */}
        <section className={card}>
          <NormVerification />
        </section>
      </main>
      <Footer />
    </div>
  )
}
