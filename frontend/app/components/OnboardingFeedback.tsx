'use client'

import { useEffect, useState, FormEvent } from 'react'
import { MessageSquare } from 'lucide-react'
import { ONBOARDING_VERSION } from '@/lib/funnel'
import { usePreferences } from '../context/usePreferences'

/**
 * Quick questions after setup (Riipen Labs: survey whether people got the
 * right amount of information about Autinerary before creating an account).
 *
 * First, "Do you know what to do next?" (Riipen Labs' cohort report: "one
 * short qualitative question such as 'Did you know what to do next?'", so
 * completion is not mistaken for understanding). "Not sure" or "No" is met
 * at once with where to start and the two-minute tour, not only counted.
 *
 * Optional and dismissible, shown once per browser per onboarding version,
 * and placed below the "Start here" steps so it never competes with the
 * primary action on that page.
 *
 * One question shows; the other four are folded under it (Riipen Labs,
 * Group 18: a "quite lengthy" survey "presented immediately after signing
 * in with no actual use of the product"; Group 15: no friction before a
 * first useful action). "Where did you hear about Autinerary?" can say who
 * pointed them here, for in-person groups (Group 15: "Let them name who
 * invited them").
 */

const DONE_KEY = `autinerary_onboarding_feedback_${ONBOARDING_VERSION}`

const NEXT_STEP_OPTIONS = [
  { id: 'yes', label: 'Yes' },
  { id: 'not_sure', label: 'Not sure' },
  { id: 'no', label: 'No' },
]

// Riipen Labs, Group 25: "ask beta testers if signup felt clear and quick".
const SIGNUP_CLEAR_OPTIONS = [
  { id: 'yes', label: 'Yes' },
  { id: 'mostly', label: 'Mostly' },
  { id: 'no', label: 'No' },
]

const INFO_OPTIONS = [
  { id: 'too_little', label: 'Not enough' },
  { id: 'about_right', label: 'About right' },
  { id: 'too_much', label: 'Too much' },
]

const EASE_LABELS = ['Very hard', 'Hard', 'Okay', 'Easy', 'Very easy']

// Riipen Labs, Group 3: "an area for the individual to indicate which platform
// they have come from". Tracked links (utm_source) only cover people who used
// one; this covers word of mouth too. Saved to profiles.preferences.heardFrom
// and counted by backend/scripts/onboarding_funnel.py.
export const HEARD_FROM = [
  { id: 'friend', label: 'A friend or family member' },
  { id: 'community-org', label: 'A community organization' },
  { id: 'parent-group', label: 'A parent group' },
  { id: 'support-group', label: 'A support group or meetup' },
  { id: 'event', label: 'An event or talk' },
  { id: 'clinician', label: 'A doctor, therapist or clinician' },
  { id: 'school', label: 'A school or teacher' },
  { id: 'riipen', label: 'Riipen' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'search', label: 'A search engine' },
  { id: 'other', label: 'Somewhere else' },
]

// Answers where a group, school or event can be named (so the team can thank
// them). People are never asked for a private person's name.
const NAMEABLE = new Set(['community-org', 'parent-group', 'support-group', 'event', 'school'])

export default function OnboardingFeedback() {
  const [hidden, setHidden] = useState(true)
  const [nextStep, setNextStep] = useState('')
  const [signupClear, setSignupClear] = useState('')
  const [info, setInfo] = useState('')
  const [ease, setEase] = useState(0)
  const [heardFrom, setHeardFrom] = useState('')
  const [invitedBy, setInvitedBy] = useState('')
  const { update } = usePreferences()
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    try {
      setHidden(Boolean(localStorage.getItem(DONE_KEY)))
    } catch {
      setHidden(false)
    }
  }, [])

  const close = () => {
    try { localStorage.setItem(DONE_KEY, '1') } catch {}
    setHidden(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nextStep && !signupClear && !info && !ease && !comment.trim() && !heardFrom) return
    setStatus('saving')
    try {
      if (nextStep || signupClear || info || ease || comment.trim()) {
        const res = await fetch('/api/onboarding-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nextStep: nextStep || undefined,
            signupClear: signupClear || undefined,
            infoBeforeSignup: info || undefined,
            setupEase: ease || undefined,
            comment: comment.trim() || undefined,
            version: ONBOARDING_VERSION,
          }),
        })
        if (!res.ok) throw new Error(String(res.status))
      }
      // Saved with the person's preferences rather than the survey.
      const named = NAMEABLE.has(heardFrom) ? invitedBy.trim().slice(0, 80) : ''
      if (heardFrom && !(await update({ heardFrom, ...(named ? { invitedBy: named } : {}) }))) throw new Error('preferences')
      try { localStorage.setItem(DONE_KEY, '1') } catch {}
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  if (hidden) return null

  if (status === 'saved') {
    return (
      <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900" role="status">
        Thank you. Your answers go straight into what we fix next.
      </div>
    )
  }

  const canSubmit = Boolean(nextStep || signupClear || info || ease || comment.trim() || heardFrom) && status !== 'saving'

  return (
    <form onSubmit={onSubmit} className="mb-6 rounded-2xl border border-slate-200 p-6 surface" aria-labelledby="feedback-heading">
      <div className="mb-1 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-indigo-700" aria-hidden="true" />
        <h2 id="feedback-heading" className="font-bold text-slate-900">A quick question (optional)</h2>
      </div>
      <p className="mb-5 text-sm text-slate-700">Autinerary is in beta. Your answers tell us what to fix in setup.</p>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Do you know what to do next?</legend>
        <div className="flex flex-wrap gap-2">
          {NEXT_STEP_OPTIONS.map((o) => (
            <label
              key={o.id}
              className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1 ${
                nextStep === o.id ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
              }`}
            >
              <input
                type="radio"
                name="next_step"
                value={o.id}
                checked={nextStep === o.id}
                onChange={() => setNextStep(o.id)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
        {(nextStep === 'not_sure' || nextStep === 'no') && (
          <p role="status" className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-slate-800">
            Start with the numbered list under &ldquo;Start here&rdquo;, at the top of this page.{' '}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('autinerary:start-demo'))}
              className="font-semibold text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
            >
              Take the two-minute tour
            </button>{' '}
            to see the rest.
          </p>
        )}
      </fieldset>

      <details className="mb-5 rounded-lg border border-slate-200 bg-white/60 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-800">Four more about setup (optional)</summary>
        <div className="mt-4">
      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Was making your account clear and quick?</legend>
        <div className="flex flex-wrap gap-2">
          {SIGNUP_CLEAR_OPTIONS.map((o) => (
            <label
              key={o.id}
              className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1 ${
                signupClear === o.id ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
              }`}
            >
              <input
                type="radio"
                name="signup_clear"
                value={o.id}
                checked={signupClear === o.id}
                onChange={() => setSignupClear(o.id)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-semibold text-slate-900">
          Before you made an account, how much did you know about what Autinerary would do for you?
        </legend>
        <div className="flex flex-wrap gap-2">
          {INFO_OPTIONS.map((o) => (
            <label
              key={o.id}
              className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1 ${
                info === o.id ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
              }`}
            >
              <input
                type="radio"
                name="info_before_signup"
                value={o.id}
                checked={info === o.id}
                onChange={() => setInfo(o.id)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-semibold text-slate-900">How easy was setup?</legend>
        <div className="flex flex-wrap gap-2">
          {EASE_LABELS.map((label, i) => (
            <label
              key={label}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1 ${
                ease === i + 1 ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
              }`}
            >
              <input
                type="radio"
                name="setup_ease"
                value={i + 1}
                checked={ease === i + 1}
                onChange={() => setEase(i + 1)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Where did you hear about Autinerary?</legend>
        <div className="flex flex-wrap gap-2">
          {HEARD_FROM.map((o) => (
            <label
              key={o.id}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1 ${
                heardFrom === o.id ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
              }`}
            >
              <input
                type="radio"
                name="heard_from"
                value={o.id}
                checked={heardFrom === o.id}
                onChange={() => setHeardFrom(o.id)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
        {NAMEABLE.has(heardFrom) && (
          <label className="mt-3 block text-sm text-slate-800">
            <span className="font-medium">Which one?</span> <span className="text-slate-700">(optional, so we can thank them)</span>
            <input
              type="text"
              value={invitedBy}
              maxLength={80}
              onChange={(e) => setInvitedBy(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="For example: the name of the group or school"
            />
          </label>
        )}
      </fieldset>

      <label htmlFor="feedback-comment" className="mb-2 block text-sm font-semibold text-slate-900">
        Anything confusing or missing? <span className="font-normal text-slate-700">(optional)</span>
      </label>
      <textarea
        id="feedback-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500"
        placeholder="e.g. I wasn't sure what a norm was"
      />
        </div>
      </details>

      {status === 'error' && (
        <p className="mt-2 text-sm text-red-700" role="alert">Could not send your answers. Please try again.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-700"
        >
          {status === 'saving' ? 'Sending…' : 'Send'}
        </button>
        <button type="button" onClick={close} className="text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
          No thanks
        </button>
      </div>
    </form>
  )
}
