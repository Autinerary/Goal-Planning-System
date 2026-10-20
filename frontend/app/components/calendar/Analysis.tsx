'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ENOUGH, bestDays, bucketsFrom, dailyPattern, energyByWeekday, hourLabel, listOf, monthlyPattern, weeklyPattern,
} from '@/lib/patterns'

/**
 * Analysis (Odosa, October 2026: "an 'Analysis' tab. When clicked, you get
 * the option to show your daily, weekly & monthly patterns, as well as your
 * best day(s)"). From things done and when (lib/patterns.ts): plan tasks
 * ticked, your own tasks done and milestones finished. Only you see it.
 */

type Tab = 'daily' | 'weekly' | 'monthly' | 'best'
const TABS: { id: Tab; label: string }[] = [
  { id: 'daily', label: 'Daily patterns' },
  { id: 'weekly', label: 'Weekly patterns' },
  { id: 'monthly', label: 'Monthly patterns' },
  { id: 'best', label: 'Best days' },
]
const TAB_KEY = 'autinerary_analysis_tab'

function Bars({ rows }: { rows: { label: string; value: number; text: string; best?: boolean }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(6rem,8rem)_1fr_auto] items-center gap-3 text-sm">
          <span className={`text-slate-900 ${r.best ? 'font-bold' : 'font-medium'}`}>{r.label}</span>
          <span aria-hidden="true" className="h-4 rounded-full bg-slate-200">
            <span className={`block h-4 rounded-full ${r.best ? 'bg-indigo-700' : 'bg-indigo-400'}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-slate-800">{r.text}</span>
        </li>
      ))}
    </ul>
  )
}

const things = (n: number) => `${n} ${n === 1 ? 'thing' : 'things'}`

export default function Analysis({
  doneHours,
  energyByDay,
  ownTasks,
  signedIn,
}: {
  doneHours?: Record<string, Record<string, number>>
  energyByDay?: Record<string, string>
  ownTasks: { completed?: boolean; completedAt?: string | null }[]
  signedIn: boolean
}) {
  const [tab, setTab] = useState<Tab>('daily')
  const [milestones, setMilestones] = useState<Date[]>([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY)
      if (TABS.some((t) => t.id === saved)) setTab(saved as Tab)
    } catch {}
  }, [])
  useEffect(() => {
    if (!signedIn) return
    fetch('/api/me/progress?kind=completed', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows: { completed_at?: string | null }[] = d?.progress || d?.rows || (Array.isArray(d) ? d : [])
        setMilestones(rows.map((r) => (r.completed_at ? new Date(r.completed_at) : null)).filter((x): x is Date => Boolean(x)))
      })
      .catch(() => null)
  }, [signedIn])

  const choose = (t: Tab) => {
    setTab(t)
    try { localStorage.setItem(TAB_KEY, t) } catch {}
  }

  const buckets = useMemo(
    () => bucketsFrom({
      doneHours,
      ownDone: ownTasks.filter((t) => t.completed && t.completedAt).map((t) => new Date(t.completedAt!)),
      milestonesDone: milestones,
    }),
    [doneHours, ownTasks, milestones],
  )
  const today = new Date()
  const best = bestDays(buckets, today)
  const enough = best.total >= ENOUGH
  const daily = dailyPattern(buckets)
  const weekly = weeklyPattern(buckets, today)
  const monthly = monthlyPattern(buckets, today)
  const energy = energyByWeekday(energyByDay)

  return (
    <section aria-labelledby="analysis-heading" className="space-y-4" data-analysis>
      <div>
        <h2 id="analysis-heading" className="text-xl font-bold text-slate-900">Analysis</h2>
        <p className="text-sm text-slate-800">
          Your patterns, to know what to aim for. From what you’ve done: plan tasks you tick (from 20 October 2026), your own tasks and milestones. Only you see this.
        </p>
      </div>

      <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => choose(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t.id ? 'bg-indigo-700 text-white shadow' : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!enough ? (
        <div className="rounded-xl border border-slate-300 bg-white p-5 text-slate-900" data-analysis-empty>
          <p className="font-semibold">Not enough yet to see patterns: {things(best.total)} done so far.</p>
          <p className="mt-1 text-sm text-slate-800">
            Tick tasks as you do them, here, in the Task View or on a task’s page, and finish milestones in Races. After a week or two, your patterns show here.
          </p>
        </div>
      ) : tab === 'daily' ? (
        <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-5" data-analysis-tab="daily">
          <h3 className="text-lg font-bold text-slate-900">Your day</h3>
          <p className="text-slate-900">
            You get the most done {daily.bestParts.length > 1 ? 'in these parts of the day' : 'in the'} <span className="font-semibold">{listOf(daily.bestParts).toLowerCase()}</span>
            {daily.peakHour !== null ? <>, most of all around <span className="font-semibold">{hourLabel(daily.peakHour)}</span></> : null}.
          </p>
          <Bars rows={daily.parts.map((p) => ({ label: p.label, value: p.count, text: things(p.count), best: daily.bestParts.includes(p.label) }))} />
          <p className="text-xs text-slate-700">{daily.parts.map((p) => `${p.label}: ${p.hours}`).join(' · ')}</p>
        </div>
      ) : tab === 'weekly' ? (
        <div className="space-y-5 rounded-xl border border-slate-300 bg-white p-5" data-analysis-tab="weekly">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900">Your week</h3>
            <p className="text-slate-900">
              On an average week, you get the most done on <span className="font-semibold">{listOf(weekly.best)}</span>.
            </p>
            <Bars rows={weekly.days.map((d) => ({ label: d.weekday, value: d.perWeek, text: `${d.perWeek} a week`, best: weekly.best.includes(d.weekday) }))} />
          </div>
          {energy.chosen >= 3 && (
            <div className="space-y-2" data-analysis-energy>
              <h4 className="font-bold text-slate-900">The energy you chose</h4>
              <p className="text-sm text-slate-800">
                {energy.highDays.length ? `High energy most on ${listOf(energy.highDays)}. ` : ''}
                {energy.lowDays.length ? `Low energy most on ${listOf(energy.lowDays)}.` : ''}
              </p>
              <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                {energy.rows.filter((r) => r.worst + r.average + r.best > 0).map((r) => (
                  <li key={r.weekday} className="text-slate-900">
                    <span className="font-medium">{r.weekday}:</span> {[r.best && `High ${r.best}`, r.average && `Balanced ${r.average}`, r.worst && `Low ${r.worst}`].filter(Boolean).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : tab === 'monthly' ? (
        <div className="space-y-5 rounded-xl border border-slate-300 bg-white p-5" data-analysis-tab="monthly">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900">Your month</h3>
            <p className="text-slate-900">
              You get the most done {monthly.bestWeeks.length > 1 ? 'on the' : 'on the'} <span className="font-semibold">{listOf(monthly.bestWeeks)}</span> of the month.
            </p>
            <Bars rows={monthly.weeks.map((w) => ({ label: w.label, value: w.count, text: things(w.count), best: monthly.bestWeeks.includes(w.label) }))} />
          </div>
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900">The last six months</h4>
            <Bars rows={monthly.months.map((m) => ({ label: m.label, value: m.count, text: things(m.count) }))} />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2" data-analysis-tab="best">
          <div className="rounded-xl border border-indigo-300 bg-indigo-50 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-indigo-900">Your best {best.weekdays.length > 1 ? 'days' : 'day'}</h3>
            <p className="mt-1 text-2xl font-bold text-slate-900" data-best-weekdays>{listOf(best.weekdays)}</p>
            <p className="mt-1 text-sm text-slate-800">Plan the bigger things for {best.weekdays.length > 1 ? 'these days' : 'this day'} when you can.</p>
          </div>
          <div className="rounded-xl border border-slate-300 bg-white p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">Your best time</h3>
            <p className="mt-1 text-2xl font-bold text-slate-900">{listOf(best.parts)}</p>
          </div>
          {best.date && (
            <div className="rounded-xl border border-slate-300 bg-white p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">Your best day so far</h3>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {new Date(`${best.date.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <p className="mt-1 text-sm text-slate-800">{things(best.date.count)} done.</p>
            </div>
          )}
          <div className="rounded-xl border border-slate-300 bg-white p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">Days with something done</h3>
            <p className="mt-1 text-2xl font-bold text-slate-900">{best.activeDays30} of the last 30</p>
          </div>
        </div>
      )}
    </section>
  )
}
