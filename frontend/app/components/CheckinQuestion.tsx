'use client'

import { useState, FormEvent } from 'react'
import { MessageSquare } from 'lucide-react'
import { ONBOARDING_VERSION } from '@/lib/funnel'
import type { CheckinKind } from '@/lib/checkin'

/**
 * One check-in question with an optional comment (see lib/checkin.ts). Used by
 * the page the check-in email links to and by the in-app prompts.
 */

interface Props {
  kind: CheckinKind
  heading: string
  intro: string
  legend: string
  options: readonly { id: string; label: string }[]
  commentLabel: string
  thanks: string
  /** The emailed link's token; answers without signing in. */
  token?: string
  /** Long options read better one per line; short ones sit side by side. */
  layout?: 'list' | 'chips'
  onAnswered?: () => void
  /** Shows a "Not now" button. */
  onDismiss?: () => void
  /** h1 when the question is the whole page. */
  headingLevel?: 'h1' | 'h2'
}

export default function CheckinQuestion({
  kind, heading, intro, legend, options, commentLabel, thanks, token, layout = 'list', onAnswered, onDismiss, headingLevel = 'h2',
}: Props) {
  const Heading = headingLevel
  const [choice, setChoice] = useState('')
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'expired'>('idle')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!choice && !comment.trim()) return
    setStatus('saving')
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          [kind === 'usefulness' ? 'usefulness' : 'reason']: choice || undefined,
          comment: comment.trim() || undefined,
          version: ONBOARDING_VERSION,
          token,
        }),
      })
      if (res.status === 401 && token) {
        setStatus('expired')
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      setStatus('saved')
      onAnswered?.()
    } catch {
      setStatus('error')
    }
  }

  if (status === 'saved') {
    return (
      <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900" role="status">
        {thanks}
      </div>
    )
  }

  const canSubmit = Boolean(choice || comment.trim()) && status !== 'saving'
  const name = `checkin-${kind}`

  return (
    <form onSubmit={onSubmit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby={`${name}-heading`}>
      <div className="mb-1 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-indigo-700" aria-hidden="true" />
        <Heading id={`${name}-heading`} className="font-bold text-slate-900">{heading}</Heading>
      </div>
      <p className="mb-5 text-sm text-slate-700">{intro}</p>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-semibold text-slate-900">{legend}</legend>
        <div className={layout === 'chips' ? 'flex flex-wrap gap-2' : 'grid gap-2'}>
          {options.map((o) => (
            <label
              key={o.id}
              className={`cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-medium focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1 ${
                choice === o.id ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.id}
                checked={choice === o.id}
                onChange={() => setChoice(o.id)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={`${name}-comment`} className="mb-2 block text-sm font-semibold text-slate-900">
        {commentLabel} <span className="font-normal text-slate-700">(optional)</span>
      </label>
      <textarea
        id={`${name}-comment`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500"
      />

      {status === 'error' && (
        <p className="mt-2 text-sm text-red-700" role="alert">Could not send your answer. Please try again.</p>
      )}
      {status === 'expired' && (
        <p className="mt-2 text-sm text-red-700" role="alert">This link has expired. Thank you for opening it all the same.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit || status === 'expired'}
          className="rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-700"
        >
          {status === 'saving' ? 'Sending…' : 'Send'}
        </button>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
            Not now
          </button>
        )}
      </div>
    </form>
  )
}
