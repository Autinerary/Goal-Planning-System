'use client'

import { useEffect, useState, FormEvent } from 'react'
import { MessageSquare } from 'lucide-react'
import { ONBOARDING_VERSION } from '@/lib/funnel'

/**
 * Two quick questions after setup (Riipen Labs: survey whether people got the
 * right amount of information about Autinerary before creating an account).
 *
 * Optional and dismissible, shown once per browser per onboarding version,
 * and placed below the "Start here" steps so it never competes with the
 * primary action on that page.
 */

const DONE_KEY = `autinerary_onboarding_feedback_${ONBOARDING_VERSION}`

const INFO_OPTIONS = [
  { id: 'too_little', label: 'Not enough' },
  { id: 'about_right', label: 'About right' },
  { id: 'too_much', label: 'Too much' },
]

const EASE_LABELS = ['Very hard', 'Hard', 'Okay', 'Easy', 'Very easy']

export default function OnboardingFeedback() {
  const [hidden, setHidden] = useState(true)
  const [info, setInfo] = useState('')
  const [ease, setEase] = useState(0)
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
    if (!info && !ease && !comment.trim()) return
    setStatus('saving')
    try {
      const res = await fetch('/api/onboarding-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          infoBeforeSignup: info || undefined,
          setupEase: ease || undefined,
          comment: comment.trim() || undefined,
          version: ONBOARDING_VERSION,
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
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

  const canSubmit = Boolean(info || ease || comment.trim()) && status !== 'saving'

  return (
    <form onSubmit={onSubmit} className="mb-6 rounded-2xl border border-slate-200 p-6 surface" aria-labelledby="feedback-heading">
      <div className="mb-1 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-indigo-700" aria-hidden="true" />
        <h2 id="feedback-heading" className="font-bold text-slate-900">Two quick questions (optional)</h2>
      </div>
      <p className="mb-5 text-sm text-slate-700">Autinerary is in beta. This tells us what to fix in setup.</p>

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
