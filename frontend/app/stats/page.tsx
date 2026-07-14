'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Brain, Smile, Target, Zap, TrendingUp, TrendingDown, Minus, Loader2, Info, Activity } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type Part = { label: string; value: number; weight: number }
type Stat = { value: number; change: number | null; score: number; parts: Part[]; source?: string }
type Payload = {
  asOf: string
  stats: { mentality: Stat; happiness: Stat & { source: string }; focus: Stat; energy: Stat }
  checkinPromptedToday: boolean
}

const META: Record<string, { label: string; Icon: any; color: string; bar: string; what: string; improve: string }> = {
  mentality: {
    label: 'Mentality',
    Icon: Brain,
    color: 'text-violet-600',
    bar: 'bg-violet-500',
    what: 'How consistently you\u2019ve been showing up \u2014 active days and reflection over the last 7 days.',
    improve: 'Check in a little each day and jot a quick reflection. Consistency matters more than volume.',
  },
  happiness: {
    label: 'Happiness',
    Icon: Smile,
    color: 'text-amber-600',
    bar: 'bg-amber-500',
    what: 'Your recent mood \u2014 from your daily check-ins when you log them, or inferred from your reflections.',
    improve: 'Log a daily mood check-in for the most accurate number. Celebrate small wins.',
  },
  focus: {
    label: 'Focus',
    Icon: Target,
    color: 'text-sky-600',
    bar: 'bg-sky-500',
    what: 'How much of what you planned you actually did \u2014 calendar tasks completed plus milestones reached.',
    improve: 'Complete the tasks you schedule, and knock out a milestone when you can. Fewer, finished tasks beat many unfinished ones.',
  },
  energy: {
    label: 'Energy',
    Icon: Zap,
    color: 'text-emerald-600',
    bar: 'bg-emerald-500',
    what: 'Your recent momentum \u2014 overall activity and social connection across the last 7 days.',
    improve: 'Take small actions often and lean on your Hare World people. Rest counts too \u2014 sustainable pace keeps energy up.',
  },
}

function Trend({ change }: { change: number | null }) {
  if (change === null) return <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Minus className="w-3 h-3" /> no baseline yet</span>
  if (change > 0) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><TrendingUp className="w-3 h-3" /> +{change.toFixed(1)} vs last week</span>
  if (change < 0) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500"><TrendingDown className="w-3 h-3" /> {change.toFixed(1)} vs last week</span>
  return <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Minus className="w-3 h-3" /> no change</span>
}

// ── Ramifications ────────────────────────────────────────────────────
// Odosa: the stats shouldn't just sit there — they should show the knock-on
// effects (ramifications) of where each number sits. This maps a stat + its
// level to a plain-language consequence so users see WHY it matters.
const RAMIFICATIONS: Record<string, { low: string; mid: string; high: string }> = {
  mentality: {
    low: 'Showing up has slipped — goals may stall without a steady rhythm. A tiny daily check-in restarts momentum.',
    mid: 'You\u2019re showing up fairly often. Locking in a daily habit would make your progress compound.',
    high: 'Strong consistency — this is powering everything else. Your other stats rise on the back of it.',
  },
  happiness: {
    low: 'Low mood drains motivation and makes focus harder. Small wins and support can lift the whole system.',
    mid: 'Mood is steady. Protecting what lifts you keeps energy and focus from dipping.',
    high: 'Good mood is fueling your drive — you\u2019ll find focus and energy easier to sustain.',
  },
  focus: {
    low: 'Plans aren\u2019t turning into done tasks — milestones drift further away. Finish one small thing to break the stall.',
    mid: 'You\u2019re completing a fair share of what you plan. Tightening follow-through speeds up your races.',
    high: 'You finish what you start — milestones are arriving on time and dreams are getting closer.',
  },
  energy: {
    low: 'Low momentum and connection make everything feel heavier. Rest and one social nudge can reset it.',
    mid: 'Momentum is okay. Regular small actions and leaning on your people keeps it from sliding.',
    high: 'High momentum — you have capacity to push a race forward or support someone else right now.',
  },
}

function levelOf(value: number): 'low' | 'mid' | 'high' {
  if (value < 4) return 'low'
  if (value < 7) return 'mid'
  return 'high'
}

function RamificationsBar({ stats, order, meta }: {
  stats: Payload['stats']
  order: Array<keyof Payload['stats']>
  meta: typeof META
}) {
  // Composite wellbeing = average of the four stats. The bar visualises each
  // stat's contribution as a stacked segment so users see the balance.
  const values = order.map((k) => stats[k].value)
  const composite = values.reduce((a, b) => a + b, 0) / values.length
  const lowest = order.reduce((lo, k) => (stats[k].value < stats[lo].value ? k : lo), order[0])
  const highest = order.reduce((hi, k) => (stats[k].value > stats[hi].value ? k : hi), order[0])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-600" /> Ramifications
        </h2>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-800">{composite.toFixed(1)}<span className="text-sm text-slate-400"> / 10</span></div>
          <div className="text-[11px] text-slate-400">overall wellbeing</div>
        </div>
      </div>
      <p className="text-sm text-slate-600 mb-3">
        Your stats feed each other. Here&apos;s the combined picture and what it means for your journey.
      </p>

      {/* Stacked contribution bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-2 border border-slate-100">
        {order.map((k) => {
          const share = (stats[k].value / (values.reduce((a, b) => a + b, 0) || 1)) * 100
          return <div key={k} className={meta[k].bar} style={{ width: `${share}%` }} title={`${meta[k].label}: ${stats[k].value.toFixed(1)}`} />
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
        {order.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-full ${meta[k].bar}`} /> {meta[k].label}
          </span>
        ))}
      </div>

      {/* Weakest link + strongest driver */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-rose-500 mb-1">Needs attention · {meta[lowest].label}</div>
          <p className="text-xs text-slate-600">{RAMIFICATIONS[lowest][levelOf(stats[lowest].value)]}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 mb-1">Your strength · {meta[highest].label}</div>
          <p className="text-xs text-slate-600">{RAMIFICATIONS[highest][levelOf(stats[highest].value)]}</p>
        </div>
      </div>
    </div>
  )
}

export default function StatsBreakdownPage() {
  const router = useRouter()
  const { supabaseUser } = useAuth()
  const isSignedIn = Boolean(supabaseUser)

  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isSignedIn) { setLoading(false); return }
      try {
        const res = await fetch('/api/me/life-stats', { cache: 'no-store', credentials: 'include' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const j = await res.json()
        if (!cancelled) setPayload(j)
      } catch (e: any) {
        if (!cancelled) setError('Couldn\u2019t load your stats right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isSignedIn])

  const order: Array<keyof Payload['stats']> = ['mentality', 'happiness', 'focus', 'energy']

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-emerald-50/40">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-slate-100 text-slate-700"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold text-slate-800">📊 Stats Breakdown</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <p className="text-sm text-slate-600 mb-6">
          These four stats reflect the last 7 days of your journey. Here&apos;s what each one means, what&apos;s driving your number, and how to nudge it up.
        </p>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-12"><Loader2 className="w-5 h-5 animate-spin" /> Loading your stats…</div>
        )}

        {!loading && !isSignedIn && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            Sign in to see your personalized stats breakdown.{' '}
            <Link href="/login" className="font-semibold underline">Sign in →</Link>
          </div>
        )}

        {!loading && error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">{error}</div>
        )}

        {!loading && isSignedIn && payload && (
          <div className="space-y-4">
            {/* Ramifications — combined picture + knock-on effects */}
            <RamificationsBar stats={payload.stats} order={order} meta={META} />

            {order.map((key) => {
              const stat = payload.stats[key]
              const meta = META[key]
              const pct = Math.round((stat.value / 10) * 100)
              const totalWeight = stat.parts.reduce((a, p) => a + p.weight, 0) || 1
              return (
                <div key={key} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <meta.Icon className={`w-5 h-5 ${meta.color}`} />
                      <h2 className="font-bold text-slate-800">{meta.label}</h2>
                      {key === 'happiness' && stat.source && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{stat.source === 'checkin' ? 'from check-ins' : 'inferred'}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-800">{stat.value.toFixed(1)}<span className="text-sm text-slate-400"> / 10</span></div>
                      <Trend change={stat.change} />
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${pct}%` }} />
                  </div>

                  {/* What it measures */}
                  <p className="text-sm text-slate-600 mb-3">{meta.what}</p>

                  {/* Ramification — what this level means for the journey */}
                  <div className="bg-slate-50 border-l-2 border-purple-300 rounded-r-lg px-3 py-2 mb-3">
                    <p className="text-xs text-slate-600"><span className="font-semibold text-purple-600">What it means: </span>{RAMIFICATIONS[key][levelOf(stat.value)]}</p>
                  </div>

                  {/* What's driving it */}
                  {stat.parts.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-3 mb-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">What&apos;s driving this</div>
                      <div className="space-y-1.5">
                        {stat.parts.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-slate-600 flex-1">{p.label}</span>
                            <span className="text-slate-400">weight {Math.round((p.weight / totalWeight) * 100)}%</span>
                            <span className="font-mono text-slate-700 w-12 text-right">{p.value < 1 ? `${Math.round(p.value * 100)}%` : p.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* How to improve */}
                  <div className="flex items-start gap-2 text-xs text-slate-600">
                    <Info className="w-3.5 h-3.5 mt-0.5 text-slate-400 flex-shrink-0" />
                    <span><span className="font-semibold text-slate-700">Boost it:</span> {meta.improve}</span>
                  </div>
                </div>
              )
            })}

            <p className="text-[11px] text-slate-400 text-center pt-2">
              As of {payload.asOf}. Stats update from your activity over a rolling 7-day window.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
