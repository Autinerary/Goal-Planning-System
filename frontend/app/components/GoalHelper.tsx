'use client'

import { useState } from 'react'
import { MessageSquareText, LifeBuoy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/funnel'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface GoalIdea {
  category: string
  text: string
}

interface Suggestion extends GoalIdea {
  source: 'idea' | 'own'
}

interface Crisis {
  message: string
  lines: { name: string; how: string }[]
  after: string
}

type Answer =
  | { kind: 'suggestions'; items: Suggestion[] }
  | { kind: 'crisis'; crisis: Crisis }
  | { kind: 'message'; text: string }

const UNAVAILABLE = 'The goal helper isn’t available just now. Pick a category above and write your goal there.'

/**
 * The goal helper: optional AI help on setup's goal step.
 *
 * Riipen Labs, Group 11 found the goal question the hardest part of setup, and
 * recommended an optional guide inside it: describe what you want in your own
 * words, get goals suggested from the existing goal ideas, then confirm or
 * edit them. Buttons first, typing optional, "clearly labelled as AI, and
 * always skippable". So it is one line until opened, labelled "AI helper",
 * and nothing is added until a suggestion is picked; the goal then sits in
 * its category's field, where it can be changed.
 *
 * The backend (core/goal_helper.py) only returns ideas from the list sent
 * here and one short goal in the person's words; words that suggest someone
 * may be in danger get the crisis lines instead, with no AI involved. Nothing
 * typed is stored, or sent to the funnel: the events say only that the helper
 * answered, and that a suggestion was added.
 */
export default function GoalHelper({
  ideas,
  categoryLabel,
  audience,
  onAdd,
}: {
  ideas: GoalIdea[]
  categoryLabel: (id: string) => string
  audience?: string
  onAdd: (category: string, text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [added, setAdded] = useState<string[]>([])

  const ask = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setAnswer(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`${API_URL}/api/onboarding/goal-helper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ text: text.trim(), audience: audience || null, ideas }),
        signal: AbortSignal.timeout(45000),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setAnswer({ kind: 'message', text: res.status === 429 && typeof json?.detail === 'string' ? json.detail : UNAVAILABLE })
      } else if (json?.crisis) {
        setAnswer({ kind: 'crisis', crisis: json.crisis })
      } else if (typeof json?.message === 'string') {
        setAnswer({ kind: 'message', text: json.message })
      } else if (json?.available === false) {
        setAnswer({ kind: 'message', text: UNAVAILABLE })
      } else {
        const items: Suggestion[] = Array.isArray(json?.suggestions) ? json.suggestions : []
        setAnswer({ kind: 'suggestions', items })
        track('feature_use', 'goal_helper')
      }
    } catch {
      setAnswer({ kind: 'message', text: UNAVAILABLE })
    } finally {
      setBusy(false)
    }
  }

  const add = (s: Suggestion) => {
    onAdd(s.category, s.text)
    setAdded((prev) => [...prev, `${s.category}:${s.text}`])
    track('feature_use', 'goal_helper_pick')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
      >
        <MessageSquareText className="h-4 w-4" aria-hidden="true" />
        Not sure how to put it? Describe it in your own words
        <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 inline-block text-xs font-semibold text-violet-900">AI helper</span>
      </button>
    )
  }

  return (
    <section aria-labelledby="goal-helper-heading" className="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="goal-helper-heading" className="font-semibold text-slate-900">Describe it in your own words</h3>
        <span className="rounded-full border border-violet-300 bg-white px-2 py-0.5 text-xs font-semibold text-violet-900">AI helper</span>
      </div>
      <p className="mt-1 text-sm text-slate-800">
        For example: &ldquo;I want a job, but interviews stress me out.&rdquo; The helper suggests goals from
        Autinerary&apos;s goal ideas, or puts yours in a few words. Nothing is added until you pick it.
      </p>
      <label htmlFor="goal-helper-text" className="mt-3 block text-sm font-medium text-slate-900">
        What would you like to do or change?
      </label>
      <textarea
        id="goal-helper-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={300}
        rows={3}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <p className="mt-1 text-xs text-slate-700">
        What you type is sent to OpenAI to make suggestions, and is not saved. You don&apos;t need to include health details.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={ask}
          disabled={!text.trim() || busy}
          className="rounded-lg bg-violet-800 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-900 disabled:bg-slate-300 disabled:text-slate-700"
        >
          {busy ? 'Finding suggestions…' : 'Suggest goals'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setAnswer(null) }}
          className="text-sm font-medium text-slate-800 underline underline-offset-2 hover:text-slate-950"
        >
          Close
        </button>
      </div>

      <div aria-live="polite">
        {answer?.kind === 'suggestions' && (
          answer.items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-800">
              No suggestions this time. Try saying it another way, or pick a category above.
            </p>
          ) : (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-900">Pick one to add it. You can change the words after.</p>
              <ul className="mt-2 space-y-2">
                {answer.items.map((s) => {
                  const done = added.includes(`${s.category}:${s.text}`)
                  return (
                    <li key={`${s.category}:${s.text}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => add(s)}
                        disabled={done}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium ${
                          done ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-violet-300 bg-white text-violet-950 hover:bg-violet-100'
                        }`}
                      >
                        {done ? <Check className="h-4 w-4" aria-hidden="true" /> : '+'} {s.text}
                      </button>
                      <span className="text-xs text-slate-700">
                        {categoryLabel(s.category)} &middot; {s.source === 'own' ? 'in your words' : 'from Autinerary’s goal ideas'}
                        {done && ' · added'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        )}
        {answer?.kind === 'message' && <p className="mt-4 text-sm text-slate-800">{answer.text}</p>}
      </div>

      {answer?.kind === 'crisis' && (
        <div role="alert" className="mt-4 rounded-lg border border-amber-400 bg-white p-4 text-sm text-slate-900">
          <p className="flex items-center gap-2 font-semibold">
            <LifeBuoy className="h-4 w-4 text-amber-800" aria-hidden="true" /> {answer.crisis.message}
          </p>
          <ul className="mt-2 space-y-1">
            {answer.crisis.lines.map((l) => (
              <li key={l.name}><span className="font-semibold">{l.name}:</span> {l.how}</li>
            ))}
          </ul>
          <p className="mt-2">{answer.crisis.after}</p>
        </div>
      )}
    </section>
  )
}
