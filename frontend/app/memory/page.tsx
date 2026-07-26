'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Trash2, CalendarDays, Flame, TrendingUp } from 'lucide-react'
import { addNote, deleteNote, useFutureNotes, type NoteTone } from '@/lib/memory'
import { useStreak, getWeekdayStats } from '@/lib/streak'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/**
 * Memory (Odosa): messages to your future self + your typical pattern & best day.
 * Notes are your own words to keep you going; the pattern is derived from the
 * days you've completed tasks (lib/streak).
 */
export default function MemoryPage() {
  const notes = useFutureNotes()
  const streak = useStreak()
  const [draft, setDraft] = useState('')
  const [tone, setTone] = useState<NoteTone>('encourage')

  // getWeekdayStats reads localStorage; safe to call on render (client page).
  const stats = getWeekdayStats()
  const bestDay = stats.bestDayIndex != null ? WEEKDAYS[stats.bestDayIndex] : null
  const maxCount = Math.max(1, ...stats.counts)

  const submit = () => {
    if (!draft.trim()) return
    addNote(draft, tone)
    setDraft('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/path" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to my Path
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Memory</h1>
        </div>
        <p className="text-slate-600 mb-6">
          Notes to your future self, and the pattern of when you show up — so you know what to aim for.
        </p>

        {/* Typical pattern & best day */}
        <div className="mb-8 rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-500" /> Typical pattern &amp; best day
          </h2>

          {stats.totalActive === 0 ? (
            <p className="text-sm text-slate-500">
              Complete a task to start building your pattern. Your most active day will show up here.
            </p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-2 h-28 mb-2">
                {stats.counts.map((c, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      className={`w-full rounded-t-md ${i === stats.bestDayIndex ? 'bg-gradient-to-t from-cyan-500 to-purple-500' : 'bg-slate-200'}`}
                      style={{ height: `${(c / maxCount) * 100}%`, minHeight: c > 0 ? '6px' : '0' }}
                      title={`${WEEKDAYS[i]}: ${c} active day${c === 1 ? '' : 's'}`}
                    />
                    <span className="text-[10px] text-slate-500 mt-1">{WEEKDAYS_SHORT[i]}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-sm mt-3">
                {bestDay && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    <CalendarDays className="w-4 h-4" /> Best day: <strong>{bestDay}</strong>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                  <Flame className="w-4 h-4" /> {streak.current}-day streak · best {streak.longest}
                </span>
              </div>
              {bestDay && (
                <p className="text-xs text-slate-500 mt-3">
                  You show up most on <strong>{bestDay}</strong>s — a good day to tackle something bigger.
                </p>
              )}
            </>
          )}
        </div>

        {/* Messages to future self */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-1">Messages to your future self</h2>
          <p className="text-sm text-slate-500 mb-4">
            Leave yourself a note to keep doing what’s working, or a nudge to do better next time.
          </p>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setTone('encourage')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                tone === 'encourage' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              💚 Keep doing good
            </button>
            <button
              onClick={() => setTone('improve')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                tone === 'improve' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              💪 Do better
            </button>
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
            rows={3}
            placeholder={tone === 'encourage' ? 'e.g. Mornings after a walk are your best — keep that up.' : 'e.g. Don’t skip the study group when it gets hard.'}
            className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-400"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={submit}
              disabled={!draft.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save note
            </button>
          </div>

          {/* Notes list */}
          <div className="mt-5 space-y-3">
            {notes.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No notes yet — your future self is listening.</p>
            )}
            {notes.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border p-3 flex items-start gap-3 ${
                  n.tone === 'encourage' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'
                }`}
              >
                <span className="text-lg flex-shrink-0">{n.tone === 'encourage' ? '💚' : '💪'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{n.text}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => deleteNote(n.id)}
                  className="text-slate-300 hover:text-red-400 flex-shrink-0"
                  aria-label="Delete note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
