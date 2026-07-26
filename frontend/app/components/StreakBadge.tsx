'use client'

import { Flame } from 'lucide-react'
import { useStreak } from '@/lib/streak'

/**
 * Visible daily-streak badge (Eliyana: "Streaks!"). Shows the current run of
 * consecutive active days. Reads live from lib/streak; renders a gentle
 * "start a streak" prompt at zero rather than an empty/red state.
 */
export default function StreakBadge({ className = '' }: { className?: string }) {
  const { current, activeToday, freezesAvailable } = useStreak()

  if (current <= 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 ${className}`}
        title="Complete a task today to start a streak"
      >
        <Flame className="w-3.5 h-3.5 text-slate-400" />
        Start a streak
      </span>
    )
  }

  const freezeNote = freezesAvailable > 0 ? ` · ${freezesAvailable} freeze${freezesAvailable > 1 ? 's' : ''} banked` : ''

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 ${className}`}
      title={
        (activeToday
          ? `${current}-day streak — counted today!`
          : `${current}-day streak — complete a task today to keep it going`) + freezeNote
      }
    >
      <Flame className="w-3.5 h-3.5 text-orange-500" />
      {current}-day streak
      {freezesAvailable > 0 && (
        <span className="ml-0.5 inline-flex items-center gap-0.5 text-sky-500" title={`${freezesAvailable} streak freeze${freezesAvailable > 1 ? 's' : ''} — auto-protects a missed day`}>
          ❄️{freezesAvailable}
        </span>
      )}
    </span>
  )
}
