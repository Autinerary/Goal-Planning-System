'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Blocking feedback modal.
 *
 * Renders a fixed full-screen overlay that embeds the project feedback form
 * (Google Forms) and refuses to dismiss until the user confirms they have
 * submitted a response. Once confirmed, a localStorage flag prevents the
 * modal from showing again on this device.
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
const SKIP_PREFIXES = ['/login', '/signup', '/auth']

export default function FeedbackGate() {
  const pathname = usePathname() || ''
  const [hydrated, setHydrated] = useState(false)
  const [done, setDone] = useState(true)         // start true to avoid SSR flash
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    setHydrated(true)
    try {
      const stored = window.localStorage.getItem(FEEDBACK_KEY) === 'true'
      setDone(stored)
    } catch {
      // No localStorage (private mode, etc.) — show the gate.
      setDone(false)
    }
  }, [])

  // Body scroll lock while the gate is up.
  useEffect(() => {
    if (!hydrated || done) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [hydrated, done])

  if (!hydrated) return null
  if (done) return null
  if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null

  const handleConfirm = () => {
    try { window.localStorage.setItem(FEEDBACK_KEY, 'true') } catch {}
    setDone(true)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-gate-title"
      aria-describedby="feedback-gate-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2
            id="feedback-gate-title"
            className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2"
          >
            <span aria-hidden="true">📝</span>
            Quick feedback — help us improve
          </h2>
          <p id="feedback-gate-desc" className="text-sm text-gray-600 mt-1">
            Before you continue, please take a moment to fill out this short form.
            Your feedback shapes what we build next.
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

        <div className="px-5 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex-shrink-0 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-start sm:items-center gap-2 text-sm text-gray-700 cursor-pointer flex-1 select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 sm:mt-0 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>I have submitted my response above.</span>
          </label>
          <div className="flex items-center gap-3">
            <a
              href={FORM_URL.replace('?embedded=true', '').replace('&embedded=true', '')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-700 hover:underline"
            >
              Open in new tab
            </a>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!confirmed}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue to app
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
