'use client'

import { useState } from 'react'
import { Heart, Loader2, X } from 'lucide-react'

interface Props {
  /** Posts the chosen mood and returns the freshly-recomputed Life Stats payload. */
  onSubmit: (mood: number, note: string | null) => Promise<void>
  /** Caller's optional dismiss handler — hides the card without submitting. */
  onDismiss?: () => void
}

const MOODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/**
 * Inline mood check-in card. Renders inside /path above the dashboard grid
 * whenever the user hasn't submitted today's check-in.
 */
export default function MoodCheckInCard({ onSubmit, onDismiss }: Props) {
  const [mood, setMood] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (mood === null || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(mood, note.trim() ? note.trim() : null)
    } catch (err: any) {
      setError(err?.message ?? 'Could not save your check-in. Try again?')
      setSubmitting(false)
    }
  }

  return (
    <div className="relative bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 border border-pink-200 rounded-2xl p-5 mb-6 shadow-sm">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss mood check-in"
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded focus:outline-none focus:ring-2 focus:ring-pink-400"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Heart className="w-5 h-5 text-pink-500" />
        <h3 className="font-semibold text-slate-800">How are you today?</h3>
        <span className="text-xs text-slate-500">(takes 5 seconds — drives your Happiness score)</span>
      </div>

      <div className="grid grid-cols-10 gap-1.5 mb-3" role="radiogroup" aria-label="Mood, 1 lowest to 10 highest">
        {MOODS.map((n) => {
          const isSelected = mood === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setMood(n)}
              disabled={submitting}
              className={[
                'h-10 rounded-lg font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-pink-400',
                isSelected
                  ? 'bg-pink-500 text-white shadow-md scale-105'
                  : 'bg-white text-slate-600 hover:bg-pink-100 border border-pink-200',
                submitting ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {n}
            </button>
          )
        })}
      </div>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything else? (optional)"
        maxLength={500}
        disabled={submitting}
        className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 bg-white/70 disabled:opacity-50"
      />

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-slate-500">
          {mood === null ? 'Pick a number from 1 (worst) to 10 (best)' : `You picked ${mood}.`}
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mood === null || submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-pink-500 hover:bg-pink-600 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Saving...' : 'Save check-in'}
        </button>
      </div>
    </div>
  )
}
