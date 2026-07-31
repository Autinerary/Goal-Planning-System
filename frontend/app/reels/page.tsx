'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronUp } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'
import { getStreak, getWeekdayStats } from '@/lib/streak'
import { fetchCompletedMilestoneIds, computeOverallProgress, computeRaceProgress, type ProgressMilestone } from '@/lib/raceProgress'

interface Slide {
  id: string
  emoji: string
  title: string
  subtitle?: string
  bg: string
}

const GRADIENTS = [
  'from-cyan-500 to-blue-600',
  'from-purple-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-fuchsia-600',
  'from-indigo-500 to-violet-600',
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Build reel slides from the user's REAL data only — nothing hardcoded. Any
 *  data source that's empty is simply skipped. */
function buildSlides(
  payload: any,
  completedIds: Set<string>,
  streak: { current: number; longest: number } | null,
  bestDayIndex: number | null,
  lifeStats: any
): Slide[] {
  const out: Slide[] = []
  const milestones: ProgressMilestone[] = Array.isArray(payload?.milestones) ? payload.milestones : []
  const rawMilestones: any[] = Array.isArray(payload?.milestones) ? payload.milestones : []
  const races: any[] = Array.isArray(payload?.races) ? payload.races : []

  // 1. Overall progress across all milestones.
  const overall = computeOverallProgress(milestones, completedIds)
  if (overall !== null) {
    const done = milestones.filter((m) => completedIds.has(m.id)).length
    out.push({
      id: 'overall',
      emoji: '📊',
      title: `${overall}% of your journey`,
      subtitle: `${done} of ${milestones.length} milestone${milestones.length === 1 ? '' : 's'} complete`,
      bg: '',
    })
  }

  // 2. Streak.
  if (streak && streak.current > 0) {
    out.push({
      id: 'streak',
      emoji: '🔥',
      title: `${streak.current}-day streak`,
      subtitle: streak.longest > streak.current ? `Your best is ${streak.longest} days` : 'Keep it going!',
      bg: '',
    })
  } else if (streak && streak.longest > 0) {
    out.push({ id: 'streak-past', emoji: '🔥', title: `Longest streak: ${streak.longest} days`, subtitle: 'Start a new one today', bg: '' })
  }

  // 3. Recently completed milestones (real names).
  const completed = rawMilestones.filter((m) => m?.id && completedIds.has(m.id)).slice(-5).reverse()
  for (const m of completed) {
    const name = typeof m.name === 'string' ? m.name : typeof m.title === 'string' ? m.title : null
    if (name) out.push({ id: `m-${m.id}`, emoji: '✅', title: name, subtitle: 'Milestone complete', bg: '' })
  }

  // 4. Per-race progress.
  for (const r of races.slice(0, 4)) {
    const pct = computeRaceProgress({ id: r?.id, name: r?.name }, milestones, completedIds)
    const name = typeof r?.name === 'string' ? r.name : null
    if (pct !== null && name) {
      out.push({ id: `r-${r.id || name}`, emoji: '🏁', title: name, subtitle: `${pct}% there`, bg: '' })
    }
  }

  // 5. Best weekday.
  if (bestDayIndex !== null && bestDayIndex >= 0 && bestDayIndex < 7) {
    out.push({ id: 'bestday', emoji: '📅', title: `${DAY_NAMES[bestDayIndex]} is your power day`, subtitle: 'When you show up most', bg: '' })
  }

  // 6. Life stats snapshot.
  const s = lifeStats?.stats
  if (s) {
    const fmt = (n: any) => (typeof n === 'number' ? n.toFixed(1) : null)
    const bits = [
      fmt(s.focus?.value) && `Focus ${fmt(s.focus.value)}`,
      fmt(s.energy?.value) && `Energy ${fmt(s.energy.value)}`,
      fmt(s.happiness?.value) && `Happiness ${fmt(s.happiness.value)}`,
      fmt(s.mentality?.value) && `Mind ${fmt(s.mentality.value)}`,
    ].filter(Boolean)
    if (bits.length) out.push({ id: 'stats', emoji: '💪', title: 'Your life stats', subtitle: `${bits.join(' · ')}  (out of 10)`, bg: '' })
  }

  // Assign rotating gradients + a motivational outro when there's real content.
  const withBg = out.map((sl, i) => ({ ...sl, bg: GRADIENTS[i % GRADIENTS.length] }))
  if (withBg.length > 0) {
    withBg.push({ id: 'outro', emoji: '✨', title: 'Keep going', subtitle: 'Your reel grows with every step you take', bg: GRADIENTS[withBg.length % GRADIENTS.length] })
  }
  return withBg
}

export default function ReelsPage() {
  const router = useRouter()
  const { payload, loading } = useAgentPath()
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null)
  const [bestDayIndex, setBestDayIndex] = useState<number | null>(null)
  const [lifeStats, setLifeStats] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Client-side (localStorage) signals.
      try {
        const st = getStreak()
        setStreak({ current: st.current, longest: st.longest })
        setBestDayIndex(getWeekdayStats().bestDayIndex)
      } catch {}
      // Server signals — best-effort.
      const [ids, ls] = await Promise.all([
        fetchCompletedMilestoneIds().catch(() => new Set<string>()),
        fetch('/api/me/life-stats', { cache: 'no-store', credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ])
      if (cancelled) return
      setCompletedIds(ids)
      setLifeStats(ls)
      setDataLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const slides = buildSlides(payload, completedIds, streak, bestDayIndex, lifeStats)
  const busy = loading || dataLoading

  return (
    <div className="fixed inset-0 bg-slate-950">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {busy ? (
        <div className="h-full flex items-center justify-center text-white/70 text-sm">Building your reel…</div>
      ) : slides.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-8 text-white">
          <div className="text-5xl mb-4">🎬</div>
          <h1 className="text-xl font-bold mb-2">Your reel is waiting</h1>
          <p className="text-white/70 text-sm max-w-xs mb-6">
            It builds itself as you make progress — complete a milestone, keep a streak, or check in on how you&apos;re doing.
          </p>
          <Link href="/milestones" className="px-5 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold">
            Go to your milestones
          </Link>
        </div>
      ) : (
        <div className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
          {slides.map((s, i) => (
            <section
              key={s.id}
              className={`h-full w-full snap-start flex flex-col items-center justify-center text-center px-8 bg-gradient-to-br ${s.bg} text-white relative`}
            >
              <div className="text-7xl mb-6 drop-shadow-lg">{s.emoji}</div>
              <h2 className="text-3xl font-extrabold leading-tight max-w-md drop-shadow">{s.title}</h2>
              {s.subtitle && <p className="mt-3 text-white/90 text-base max-w-sm">{s.subtitle}</p>}

              {/* Position + swipe hint */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  {slides.map((_, j) => (
                    <span key={j} className={`h-1 rounded-full transition-all ${j === i ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`} />
                  ))}
                </div>
                {i === 0 && slides.length > 1 && (
                  <div className="flex items-center gap-1 text-white/70 text-xs animate-bounce">
                    <ChevronUp className="w-3.5 h-3.5" /> swipe up
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
