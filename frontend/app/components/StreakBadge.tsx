'use client'

import { Flame } from 'lucide-react'
import { useStreak } from '@/lib/streak'

/**
 * Visible daily-streak badge (Eliyana: "Streaks!"). Shows the current run of
 * consecutive active days. Reads live from lib/streak.
 *
 * Nothing renders below two days (Odosa) — a "1-day streak" isn't a streak, and
 * a nagging empty state on day one is worse than no badge at all.
 */
export default function StreakBadge({ className = '' }: { className?: string }) {
  const { current, activeToday, freezesAvailable } = useStreak()

  if (current < 2) return null

  const freezeNote = freezesAvailable > 0 ? ` · ${freezesAvailable} freeze${freezesAvailable > 1 ? 's' : ''} banked` : ''

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 ${className}`}
      title={
        (activeToday
          ? `On a ${current} day streak. Counted today!`
          : `On a ${current} day streak. Open the app today to keep it going`) + freezeNote
      }
    >
      <Flame className="w-3.5 h-3.5 text-orange-500" />
      On a {current} day streak!
      {freezesAvailable > 0 && (
        <span className="ml-0.5 inline-flex items-center gap-0.5 text-sky-500" title={`${freezesAvailable} streak freeze${freezesAvailable > 1 ? 's' : ''}, auto-protects a missed day`}>
          ❄️{freezesAvailable}
        </span>
      )}
    </span>
  )
}
