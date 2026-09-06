'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const INDICATOR_LABEL: Record<string, string> = {
  task_avoidance: 'Putting the task off',
  sleep_issues: 'Skipping sleep before it',
  social_withdrawal: 'Isolating instead of asking for help',
  sensory_overload: 'Pushing through sensory overload',
  energy_crash: 'Starting on empty — no recovery first',
  meal_skipping: 'Skipping meals around it',
}

interface Mistake { indicator: string; pct: number; sample_size: number }

/**
 * "What NOT to do at this stage" — Odosa's "Top 5 mistakes + percentages".
 *
 * Every number here comes from real reflections other users wrote at this
 * exact milestone stage (milestone ids are structural, so this pools real
 * cross-user signal, not one person's history). Below 5 reflections for this
 * stage the backend returns nothing and this renders nothing — a stage two
 * people have reached does not get a fabricated "80% of people struggle here".
 */
export default function CommonMistakes({ milestoneId }: { milestoneId: string }) {
  const [mistakes, setMistakes] = useState<Mistake[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/api/paths/milestones/${encodeURIComponent(milestoneId)}/common-mistakes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && Array.isArray(j?.mistakes)) setMistakes(j.mistakes) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [milestoneId])

  if (mistakes.length === 0) return null

  return (
    <div className="mt-6 pt-6 border-t border-slate-200">
      <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        What trips people up here
      </h3>
      <div className="space-y-2">
        {mistakes.map((m) => (
          <div key={m.indicator} className="flex items-center gap-3">
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 tabular-nums">
              {m.pct}%
            </span>
            <span className="text-sm text-slate-700">
              {INDICATOR_LABEL[m.indicator] || m.indicator}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        From {mistakes[0].sample_size} people who reflected at this stage.
      </p>
    </div>
  )
}
