'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarHeart } from 'lucide-react'
import MoodCheckInCard from './MoodCheckInCard'

/**
 * Mood calendar: the last five weeks of "How are you today?" (Riipen Labs,
 * Group 34: "improve the Life Stats toggle and happiness calendar so they are
 * easier to understand and use"). Check-ins were saved and averaged into
 * Happiness, and never shown back. Each day shows its number as well as a
 * colour, so colour is never the only cue. Today's check-in can be made here
 * too: on the Path it only appears after "Show more".
 *
 * Days are the dates the check-ins are stored under (UTC, as
 * /api/me/life-stats/checkin saves them).
 */

const WEEKS = 5
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_MS = 86_400_000

function utcKey(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

function band(mood: number): { cell: string; word: string } {
  if (mood <= 3) return { cell: 'bg-rose-100 text-rose-900 border-rose-200', word: 'low' }
  if (mood <= 6) return { cell: 'bg-amber-100 text-amber-900 border-amber-200', word: 'middle' }
  return { cell: 'bg-emerald-100 text-emerald-900 border-emerald-200', word: 'good' }
}

export default function MoodCalendar({ onPayload }: { onPayload?: (payload: any) => void }) {
  const [moods, setMoods] = useState<Record<string, number> | null>(null)
  const [failed, setFailed] = useState(false)

  // Five whole weeks, Monday to Sunday, ending with this week.
  const todayKey = utcKey(Date.now())
  const today = new Date(`${todayKey}T00:00:00Z`)
  const mondayOffset = (today.getUTCDay() + 6) % 7
  const shownDays = mondayOffset + (WEEKS - 1) * 7 + 1
  const start = today.getTime() - (shownDays - 1) * DAY_MS
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const t = start + (w * 7 + d) * DAY_MS
      return { key: utcKey(t), date: new Date(t), future: t > today.getTime() }
    })
  )

  const load = useCallback(() => {
    fetch(`/api/me/life-stats/checkin?days=${shownDays}`, { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        const next: Record<string, number> = {}
        for (const c of j.checkins || []) next[c.date] = c.mood
        setMoods(next)
      })
      .catch(() => setFailed(true))
  }, [shownDays])
  useEffect(() => { load() }, [load])

  const values = moods ? Object.values(moods) : []
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const checkedInToday = Boolean(moods && moods[todayKey] != null)

  const submit = async (mood: number, note: string | null) => {
    const res = await fetch('/api/me/life-stats/checkin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood, note }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.error || 'Could not save your check-in. Try again?')
    if (json?.stats && onPayload) onPayload(json)
    load()
  }

  return (
    <section aria-labelledby="mood-calendar-heading" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarHeart className="w-5 h-5 text-pink-600" aria-hidden="true" />
        <h2 id="mood-calendar-heading" className="font-bold text-slate-800">Mood calendar</h2>
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Your answers to “How are you today?” over the last five weeks. They make up Happiness. Only you can see this.
      </p>

      {moods && !checkedInToday && <MoodCheckInCard onSubmit={submit} />}

      {failed && <p className="text-sm text-rose-700">Your check-ins could not be loaded just now.</p>}
      {!moods && !failed && <p className="text-sm text-slate-600">Loading…</p>}

      {moods && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] table-fixed border-separate" style={{ borderSpacing: '4px' }}>
              <caption className="sr-only">Mood check-ins by day, last five weeks</caption>
              <thead>
                <tr>
                  {WEEKDAYS.map((d) => (
                    <th key={d} scope="col" className="text-xs font-semibold text-slate-600">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week[0].key}>
                    {week.map(({ key, date, future }) => {
                      const mood = moods[key]
                      const label = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
                      const b = mood != null ? band(mood) : null
                      return (
                        <td key={key} className="p-0">
                          <div
                            className={`flex h-12 flex-col items-center justify-center rounded-lg border text-center ${
                              b ? b.cell : future ? 'border-transparent bg-transparent text-slate-500' : 'border-dashed border-slate-200 bg-slate-50 text-slate-600'
                            } ${key === todayKey ? 'ring-2 ring-indigo-600 ring-offset-1' : ''}`}
                          >
                            <span aria-hidden="true" className="text-[10px] leading-none">{date.getUTCDate()}</span>
                            <span aria-hidden="true" className="text-base font-bold leading-tight">{mood ?? ''}</span>
                            <span className="sr-only">
                              {label}{key === todayKey ? ' (today)' : ''}: {mood != null ? `mood ${mood} out of 10, ${b!.word}` : future ? 'not yet' : 'no check-in'}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded border border-rose-200 bg-rose-100" />1 to 3</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded border border-amber-200 bg-amber-100" />4 to 6</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded border border-emerald-200 bg-emerald-100" />7 to 10</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded border border-dashed border-slate-300 bg-slate-50" />No check-in</span>
          </div>

          <p className="mt-3 text-sm text-slate-700">
            {values.length === 0
              ? 'No check-ins in the last five weeks yet.'
              : `You checked in on ${values.length} of the last ${shownDays} days. Your average mood was ${average!.toFixed(1)} out of 10.`}
          </p>
        </>
      )}
    </section>
  )
}
