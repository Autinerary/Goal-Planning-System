'use client'

import { useCallback, useEffect, useState } from 'react'
import { Brain, Heart, Target, Zap, TrendingUp, TrendingDown, Sparkles, Loader2, Info } from 'lucide-react'
import MoodCheckInCard from './MoodCheckInCard'

// Mirrors the API payload shape from /api/me/life-stats.
interface StatResponse {
  value: number
  score: number
  change: number | null
  parts: { label: string; value: number; weight: number }[]
}
interface HappinessResponse extends StatResponse { source: 'checkin' | 'inferred' }
interface LifeStatsPayload {
  asOf: string
  stats: {
    mentality: StatResponse
    happiness: HappinessResponse
    focus: StatResponse
    energy: StatResponse
  }
  checkinPromptedToday: boolean
}

type StatKey = 'mentality' | 'happiness' | 'focus' | 'energy'

const STAT_META: Record<StatKey, {
  label: string
  icon: any
  color: string
  bgColor: string
  barColor: string
}> = {
  mentality: { label: 'Mentality', icon: Brain,  color: 'text-purple-600', bgColor: 'bg-purple-100', barColor: 'bg-purple-500' },
  happiness: { label: 'Happiness', icon: Heart,  color: 'text-pink-600',   bgColor: 'bg-pink-100',   barColor: 'bg-pink-500' },
  focus:     { label: 'Focus',     icon: Target, color: 'text-cyan-600',   bgColor: 'bg-cyan-100',   barColor: 'bg-cyan-500' },
  energy:    { label: 'Energy',    icon: Zap,    color: 'text-amber-600',  bgColor: 'bg-amber-100',  barColor: 'bg-amber-500' },
}

const STAT_ORDER: StatKey[] = ['mentality', 'happiness', 'focus', 'energy']

/**
 * Live Life Stats card. Replaces the old hardcoded array in app/path/page.tsx.
 * - Fetches /api/me/life-stats on mount.
 * - Shows the mood check-in inline when the user hasn't logged today.
 * - Trend arrows only render when a baseline snapshot exists (no fake +10%).
 * - Click a stat to see exactly what fed into the number.
 */
export default function LifeStatsCard() {
  const [payload, setPayload] = useState<LifeStatsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissedCheckin, setDismissedCheckin] = useState(false)
  const [openStat, setOpenStat] = useState<StatKey | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me/life-stats', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in to see your live Life Stats.')
        } else {
          setError('Could not load your Life Stats just now.')
        }
        setPayload(null)
        return
      }
      const data = (await res.json()) as LifeStatsPayload
      setPayload(data)
      setError(null)
    } catch {
      setError('Could not load your Life Stats just now.')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCheckinSubmit(mood: number, note: string | null) {
    const res = await fetch('/api/me/life-stats/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood, note }),
    })
    if (!res.ok) {
      const msg = await res.json().catch(() => ({ error: 'Save failed' }))
      throw new Error(msg.error ?? 'Save failed')
    }
    const data = (await res.json()) as LifeStatsPayload
    if (data?.stats) setPayload(data)
    else await refresh()
  }

  const showCheckin = !loading && payload && !payload.checkinPromptedToday && !dismissedCheckin

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="font-bold text-lg text-slate-800 mb-1 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-emerald-500" />
        Life Stats
      </h2>
      <p className="text-xs text-slate-500 italic mb-4">
        Computed from your activity over the last 7 days.
      </p>

      {showCheckin && (
        <MoodCheckInCard
          onSubmit={handleCheckinSubmit}
          onDismiss={() => setDismissedCheckin(true)}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Computing your stats…
        </div>
      )}

      {error && !loading && (
        <div className="text-sm text-slate-500 italic py-2">{error}</div>
      )}

      {payload && !loading && (
        <div className="space-y-4">
          {STAT_ORDER.map((key) => {
            const stat = payload.stats[key]
            const meta = STAT_META[key]
            const Icon = meta.icon
            const widthPct = Math.max(0, Math.min(100, stat.score))
            const trend = renderTrend(stat.change)
            const isOpen = openStat === key
            return (
              <div key={key} className="border-b border-slate-100 last:border-b-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <button
                    type="button"
                    onClick={() => setOpenStat(isOpen ? null : key)}
                    className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded -ml-1 px-1 py-0.5 hover:bg-slate-50"
                    aria-expanded={isOpen}
                    aria-controls={`stat-${key}-details`}
                  >
                    <div className={`w-9 h-9 rounded-lg ${meta.bgColor} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${meta.color}`} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        {meta.label}
                        <Info className="w-3 h-3 text-slate-400" aria-hidden="true" />
                      </p>
                      {trend && (
                        <p className={`text-xs font-medium ${trend.colorClass}`}>{trend.label}</p>
                      )}
                    </div>
                  </button>
                  <div className="text-right">
                    <span className={`font-bold text-sm ${meta.color}`}>
                      {stat.value.toFixed(1)}<span className="text-slate-400 font-medium">/10</span>
                    </span>
                    {key === 'happiness' && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {payload.stats.happiness.source === 'checkin'
                          ? 'from your mood check-ins'
                          : 'estimated — check in to make it exact'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${meta.barColor} rounded-full transition-all`}
                    style={{ width: `${widthPct}%` }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(widthPct)}
                    aria-label={`${meta.label}: ${stat.value} out of 10`}
                  />
                </div>

                {isOpen && (
                  <div
                    id={`stat-${key}-details`}
                    className="mt-3 bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1.5"
                  >
                    <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-slate-400" />
                      How this number is computed
                    </p>
                    {stat.parts.map((part, idx) => (
                      <p key={idx} className="flex justify-between gap-2">
                        <span>{part.label}</span>
                        <span className="text-slate-400 whitespace-nowrap">
                          weight {Math.round(part.weight * 100)}%
                        </span>
                      </p>
                    ))}
                    {key === 'happiness' && payload.stats.happiness.source === 'inferred' && (
                      <p className="pt-1 text-slate-500 italic">
                        Tip: Use today&apos;s mood check-in to switch this from an estimate to your real number.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function renderTrend(change: number | null) {
  if (change === null) return null
  // Ignore noise — only show an arrow when the move is meaningful.
  if (Math.abs(change) < 0.1) return null
  if (change > 0) {
    return {
      label: `↑ +${change.toFixed(1)} from last week`,
      colorClass: 'text-emerald-600',
    }
  }
  return {
    label: `↓ ${change.toFixed(1)} from last week`,
    colorClass: 'text-rose-500',
  }
}
