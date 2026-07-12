'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Brain, Smile, Target, Zap, TrendingUp, TrendingDown, Minus, Loader2, Info } from 'lucide-react'
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
