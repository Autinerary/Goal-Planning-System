'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { dayKey, getVisitDayCountSince } from '@/lib/disclosure'
import { useAuth } from '../context/AuthContext'

/**
 * The feedback form, asked for once.
 *
 * A full-screen overlay that embeds the project feedback form (Google Forms).
 * It is optional: "Not now" (or Escape) asks again in a week, "Don't ask
 * again" never does, and "I sent it" thanks them; it used to refuse to close
 * until someone said they had sent it, which is a forced action (the
 * compliance checklist, November 2026: "Remove dark patterns"). Once answered,
 * a localStorage flag keeps it from showing again on this device.
 *
 * Override the embedded URL via NEXT_PUBLIC_FEEDBACK_FORM_URL — supply the
 * "embedded" iframe URL from Google Forms (Send → < > Embed HTML).
 */

// Bump this version string to re-prompt every user (e.g. after a new form).
const FEEDBACK_KEY = 'autinerary_feedback_completed_v1'

// Editor URL the team shared was:
//   https://docs.google.com/forms/d/1tgGgG5eeBuM7BT9OjmgSREiOcd5wZl2MbE067NM-ZHg/edit?ts=6a37362f
// The standard public viewform URL for the same form ID:
const DEFAULT_FORM_ID = '1tgGgG5eeBuM7BT9OjmgSREiOcd5wZl2MbE067NM-ZHg'
const DEFAULT_FORM_URL = `https://docs.google.com/forms/d/${DEFAULT_FORM_ID}/viewform?embedded=true`

const FORM_URL = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL || DEFAULT_FORM_URL

// Routes where the gate must NOT block (auth/onboarding entry — otherwise
// brand-new users could be locked out before they have an account).
const SKIP_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth', '/onboarding', '/onboarding-confirmation', '/checkin', '/privacy', '/terms', '/newsletter', '/community-choice', '/spot-guides', '/petition', '/pricing', '/providers', '/billing', '/free-access', '/business', '/help', '/about', '/cookies', '/refunds', '/delete-my-data', '/credits', '/emails']

/**
 * How much use has to happen before we are entitled to ask.
 *
 * A tester's note: the form was "asked immediately, better to wait". It was
 * — this gate blocked the very first page a signed-in person landed on,
 * before they had used a single feature. Feedback collected at that point
 * is worthless to us and the interruption is hostile to them, especially
 * for an audience this app exists to be gentler on.
 *
 * Two days of use means they have come back once, which is the point at
 * which they have something to say. The dwell timer stops the gate landing
 * mid-action on the day it does become due.
 */
const MIN_VISIT_DAYS = 2
const MIN_DWELL_MS = 90_000
/** "Not now" asks again after this many days. */
const LATER_DAYS = 7
const LATER_KEY = `${FEEDBACK_KEY}_later`

export default function FeedbackGate() {
  const pathname = usePathname() || ''
  // Only people who have used the app: signed in, setup finished, and back
  // on a later day than they signed up. Visits were counted on every page, so
  // a visitor who looked at the home page on two days got this blocking form
  // before making an account, and someone who browsed yesterday got it on
  // their first day (Riipen Labs, Group 7: a "feedback survey appearing
  // before product use may feel premature").
  const { user, supabaseUser } = useAuth()
  const joined = supabaseUser?.created_at ? dayKey(new Date(supabaseUser.created_at)) : null
  const usedEnough = Boolean(user?.hasCompletedOnboarding && joined && getVisitDayCountSince(joined) >= MIN_VISIT_DAYS)
  const [hydrated, setHydrated] = useState(false)
  const [done, setDone] = useState(true)         // start true to avoid SSR flash
  const panel = useRef<HTMLDivElement>(null)
  // Whether enough use has happened AND enough of this session has elapsed.
  const [earnedTheRight, setEarnedTheRight] = useState(false)
  const skipped = SKIP_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))

  useEffect(() => {
    setHydrated(true)
    try {
      const stored = window.localStorage.getItem(FEEDBACK_KEY) === 'true'
      const later = window.localStorage.getItem(LATER_KEY)
      setDone(stored || Boolean(later && later > dayKey(new Date())))
    } catch {
      // No localStorage (private mode, etc.) — show the gate.
      setDone(false)
    }
  }, [])

  // Hold the gate until the person has actually used the app, then wait out
  // the dwell timer so it does not land in the middle of what they are doing.
  useEffect(() => {
    if (!hydrated || done || !usedEnough) return
    const timer = setTimeout(() => setEarnedTheRight(true), MIN_DWELL_MS)
    return () => clearTimeout(timer)
  }, [hydrated, done, usedEnough])

  // Body scroll lock while the gate is up.
  useEffect(() => {
    if (!hydrated || done || skipped || !earnedTheRight) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [hydrated, done, skipped, earnedTheRight])

  const showing = hydrated && !done && !skipped && earnedTheRight && usedEnough

  const answer = (how: 'sent' | 'never' | 'later') => {
    try {
      if (how === 'later') {
        const again = new Date()
        again.setDate(again.getDate() + LATER_DAYS)
        window.localStorage.setItem(LATER_KEY, dayKey(again))
      } else {
        window.localStorage.setItem(FEEDBACK_KEY, 'true')
      }
      // CheckinPrompt waits for another day before asking anything else.
      window.localStorage.setItem(`${FEEDBACK_KEY}_on`, new Date().toISOString().slice(0, 10))
    } catch {}
    setDone(true)
  }

  // Escape is "Not now", and the form is where the keyboard starts.
  useEffect(() => {
    if (!showing) return
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer('later')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showing]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!showing) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-gate-title"
      aria-describedby="feedback-gate-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 overlay-scroll"
    >
      <div ref={panel} tabIndex={-1} className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden focus:outline-none">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2
            id="feedback-gate-title"
            className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2"
          >
            <span aria-hidden="true">📝</span>
            Quick feedback: help us improve
          </h2>
          <p id="feedback-gate-desc" className="text-sm text-gray-600 mt-1">
            If you have a few minutes, this short form shapes what we build next.
            It is optional: you can skip it.
          </p>
        </div>

        <div className="flex-1 min-h-[420px] overflow-hidden bg-gray-50">
          <iframe
            src={FORM_URL}
            title="Feedback form"
            className="w-full h-full"
            style={{ minHeight: 480, border: 0 }}
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          >
            Loading…
          </iframe>
        </div>

        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex-shrink-0 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => answer('later')}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => answer('never')}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Don’t ask again
            </button>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={FORM_URL.replace('?embedded=true', '').replace('&embedded=true', '')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-700 underline underline-offset-2"
            >
              Open in new tab
            </a>
            <button
              type="button"
              onClick={() => answer('sent')}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-700 text-white hover:bg-blue-800 transition-colors"
            >
              I sent it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
