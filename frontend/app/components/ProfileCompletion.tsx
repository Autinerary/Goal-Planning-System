'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ChevronRight, UserCog, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/usePreferences'
import { track } from '@/lib/funnel'
import { PROFILE_ITEMS, itemDone, nextProfileItem, profileProgress, type ProfileItem, type ProfileItemId } from '@/lib/profileItems'
import { dayKey, daysSince } from '@/lib/disclosure'
import LocationField from './LocationField'
import MotivationField from './MotivationField'
import DisplaySettings from './DisplaySettings'
import FirstWeeksReminder from './FirstWeeksReminder'
import { MOTIVATION_OPTIONS, LIFE_STAGES } from '@/lib/motivationChoices'

/**
 * "Complete your profile": the optional questions that left setup (Riipen
 * Labs, Groups 25 to 30), in one optional card (Group 29: "an optional
 * 'Complete Your Profile' card on the main dashboard, allowing users to
 * personalize their account whenever they choose"). Each says what it
 * unlocks (lib/profileItems.ts). Four are answered right here; the others
 * open where they live. Progress shows as "2 of 7" (Group 29: "progress bars
 * and ... mini-rewards").
 *
 * On the Path it shows the next question and "See all", so it never asks
 * everything at once (Group 30: "reduce the number of choices and questions
 * shown at once"), and it can be hidden there; on Your profile it is always
 * there, open. The next question follows the days since sign-up, as the
 * Path's "ask later" card did, which this replaces (Group 5: norms and
 * sensory needs from the second week; lib/profileItems.ts, fromDay). Answers count in the funnel as ask_later events
 * ("shown.profile", "done.profile.<id>"), wherever they were given.
 */

const HIDDEN_KEY = 'autinerary_profile_card_hidden'
const SHOWN_KEY = 'autinerary_profile_card_shown'
// The items already answered, as last seen in this browser, so an answer
// is counted once, when it is new.
const DONE_KEY = 'autinerary_profile_card_done'

export default function ProfileCompletion({ variant = 'path' }: { variant?: 'path' | 'page' }) {
  const { supabaseUser } = useAuth()
  const { prefs, synced } = usePreferences()
  const [city, setCity] = useState<{ city: string; province: string; country: string } | null | undefined>(undefined)
  const [hasNorms, setHasNorms] = useState<boolean | undefined>(undefined)
  const [hidden, setHidden] = useState(false)
  const [all, setAll] = useState(variant === 'page')
  const [openItem, setOpenItem] = useState<ProfileItemId | null>(null)
  const [justDone, setJustDone] = useState<ProfileItemId | null>(null)
  const counted = useRef(false)

  useEffect(() => {
    if (variant === 'path') {
      try { setHidden(localStorage.getItem(HIDDEN_KEY) === '1') } catch {}
    }
  }, [variant])

  useEffect(() => {
    if (!supabaseUser?.id) return
    let cancelled = false
    fetch('/api/me/location', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setCity(j ? j.location || null : null) })
      .catch(() => { if (!cancelled) setCity(null) })
    Promise.all([
      fetch('/api/me/norms', { cache: 'no-store', credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/me/diagnostic-profile', { cache: 'no-store', credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([norms, support]) => {
      if (cancelled) return
      const profile = support?.diagnosticProfile?.profile
      const supportSaved = Boolean(profile && ((profile.conditions || []).length > 0 ||
        Object.values(profile.supportContext || {}).some((v) => typeof v === 'string' && v.trim())))
      setHasNorms((norms?.norms || []).length > 0 || supportSaved)
    })
    return () => { cancelled = true }
  }, [supabaseUser?.id])

  const loaded = city !== undefined && hasNorms !== undefined
  const state = {
    hasCity: Boolean(city?.city),
    hasNorms: Boolean(hasNorms),
    motivation: prefs.motivation,
    character: prefs.character,
    gamification: prefs.gamification,
    viewPreference: prefs.viewPreference,
    accessibility: prefs.accessibility,
    reminders: prefs.reminders,
  }
  const { done, todo } = profileProgress(state)

  // Count the card once per browser, and each answer once, when it is new.
  useEffect(() => {
    if (!loaded || hidden || counted.current) return
    counted.current = true
    try {
      if (!localStorage.getItem(SHOWN_KEY)) {
        localStorage.setItem(SHOWN_KEY, '1')
        track('ask_later', 'shown.profile')
      }
    } catch {}
  }, [loaded, hidden])
  const doneKey = done.join(',')
  useEffect(() => {
    // Only once the account's own settings are in, so answers saved on
    // another device are not counted as new here.
    if (!loaded || !synced) return
    try {
      const before = localStorage.getItem(DONE_KEY)
      if (before !== null) {
        const known = new Set(before.split(',').filter(Boolean))
        for (const id of done) if (!known.has(id)) track('ask_later', `done.profile.${id}`)
      }
      localStorage.setItem(DONE_KEY, doneKey)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, synced, doneKey])

  if (!loaded || (variant === 'path' && hidden)) return null

  const total = PROFILE_ITEMS.length
  // Days since the account was made; unknown counts as day 0.
  const day = supabaseUser?.created_at ? daysSince(dayKey(new Date(supabaseUser.created_at))) : 0
  const next = nextProfileItem(todo, day)
  const shownItems = all ? PROFILE_ITEMS : PROFILE_ITEMS.filter((item) => item.id === next)
  // What is saved, said under the question while it is closed (Riipen Labs,
  // Group 34: "closed, it says what is picked").
  const answerOf = (id: ProfileItemId): string => {
    if (id === 'location') return city?.city ? [city.city, city.province].filter(Boolean).join(', ') : ''
    if (id === 'motivation') {
      const m = prefs.motivation
      const names = [
        ...(m?.types || []).map((t) => MOTIVATION_OPTIONS.find((o) => o.value === t)?.label),
        ...(m?.lifeStages || []).map((t) => LIFE_STAGES.find((o) => o.id === t)?.label),
      ].filter(Boolean)
      return names.join('; ')
    }
    if (id === 'reminders' && prefs.reminders?.enabled) {
      const until = prefs.reminders.until
      return until ? `On, until ${new Date(`${until}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}` : 'On'
    }
    return ''
  }
  // After the first two weeks the reminder has no end date.
  const titleOf = (item: ProfileItem) => item.id === 'reminders' && day >= 14 ? 'A daily reminder email' : item.title
  const unlocksOf = (item: ProfileItem) => item.id === 'reminders' && day >= 14 ? 'One short email a day about your next step. Turn it off any time.' : item.unlocks
  const complete = todo.length === 0
  const finish = (id: ProfileItemId) => {
    setJustDone(id)
    setOpenItem(null)
  }

  const editor = (id: ProfileItemId) => {
    switch (id) {
      case 'location': return <LocationField idPrefix={`${variant}-profile-city`} initial={city} onSaved={(loc) => { setCity(loc); finish('location') }} />
      case 'motivation': return <MotivationField onSaved={() => finish('motivation')} />
      case 'look': return <DisplaySettings onChange={() => setJustDone('look')} />
      case 'reminders': return <FirstWeeksReminder onSaved={() => finish('reminders')} />
      default: return null
    }
  }

  return (
    <section aria-labelledby={`profile-card-heading-${variant}`} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`profile-card-heading-${variant}`} className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <UserCog className="h-5 w-5 text-indigo-700" aria-hidden="true" />
            Complete your profile <span className="text-sm font-normal text-slate-700">(optional)</span>
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            {complete
              ? 'Every question is answered. Change any of them here whenever you like.'
              : 'Setup asked only what your plan needed. Add the rest whenever you like: each one changes what the app shows you.'}
          </p>
        </div>
        {variant === 'path' && (
          <button
            type="button"
            onClick={() => { try { localStorage.setItem(HIDDEN_KEY, '1') } catch {}; setHidden(true) }}
            aria-label="Hide this card. It stays on Your profile."
            title="Hide this card. It stays on Your profile."
            className="shrink-0 rounded-md p-1 text-slate-600 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Progress: how many of the seven are answered. */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-900">{done.length} of {total} done</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Profile questions answered" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.length}>
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${(done.length / total) * 100}%` }} />
        </div>
      </div>

      {justDone && itemDone(justDone, state) && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          Added. {done.length} of {total} done{todo.length ? '.' : ': your profile is complete.'}
        </p>
      )}

      {!complete || all ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {shownItems.map((item) => {
            const isDone = itemDone(item.id, state)
            const isOpen = openItem === item.id
            return (
              <li key={item.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold text-slate-900">
                      {isDone
                        ? <Check className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                        : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-400" aria-hidden="true" />}
                      <span className="sr-only">{isDone ? 'Done: ' : 'Not yet: '}</span>
                      {titleOf(item)}
                    </p>
                    <p className="ml-6 text-sm text-slate-700">{unlocksOf(item)}</p>
                    {!isOpen && answerOf(item.id) && (
                      <p className="ml-6 mt-0.5 text-sm text-slate-900"><span className="font-medium">Picked:</span> {answerOf(item.id)}</p>
                    )}
                  </div>
                  {item.inline ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenItem(isOpen ? null : item.id)}
                      className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-400 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-500"
                    >
                      {isOpen ? 'Close' : isDone ? 'Change' : 'Add'}
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                  ) : (
                    <Link
                      href={item.href || '/profile'}
                      className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-400 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-500"
                    >
                      {isDone ? 'Change' : 'Add'}<span className="sr-only">: {titleOf(item)}</span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
                {isOpen && <div className="ml-6 mt-3">{editor(item.id)}</div>}
              </li>
            )
          })}
        </ul>
      ) : null}

      {variant === 'path' && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll(!all)}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${all ? 'rotate-180' : ''}`} aria-hidden="true" />
          {all ? 'Show just the next one' : complete ? `See all ${total}` : `See all ${total} questions`}
        </button>
      )}
    </section>
  )
}
