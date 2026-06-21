'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy, Calendar as CalIcon, Loader2, User as UserIcon } from 'lucide-react'

interface Profile {
  id: string
  display_name: string | null
  avatar_emoji: string | null
  dream: string | null
}

interface CalendarTask {
  id: string
  day: string
  time: string
  name: string
  duration: string
  priority: string
}

interface ProgressRow {
  milestone_id: string
  kind: 'completed' | 'hearted'
}

interface SidePayload {
  profile: Profile | null
  path: any | null
  calendar: CalendarTask[]
  progress: ProgressRow[]
}

const PRIORITY_COLOR: Record<string, string> = {
  essential: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
  wellness: 'bg-blue-100 text-blue-800 border-blue-200',
  growth: 'bg-purple-100 text-purple-800 border-purple-200',
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function extractRaces(path: any): any[] {
  if (!path) return []
  if (Array.isArray(path.races)) return path.races
  if (Array.isArray(path?.path?.races)) return path.path.races
  return []
}

function groupByDay(tasks: CalendarTask[]): Record<string, CalendarTask[]> {
  return tasks.reduce<Record<string, CalendarTask[]>>((acc, t) => {
    ;(acc[t.day] ||= []).push(t)
    return acc
  }, {})
}

function PathwayColumn({ data, accent }: { data: SidePayload | null; accent: string }) {
  if (!data) return <p className="text-sm text-slate-400 italic">No pathway data.</p>
  const races = extractRaces(data.path)
  const completedSet = new Set(data.progress.filter(p => p.kind === 'completed').map(p => p.milestone_id))
  if (races.length === 0) return <p className="text-sm text-slate-400 italic">No races yet.</p>
  return (
    <div className="space-y-3">
      {races.map((r: any, idx: number) => {
        const milestones: any[] = Array.isArray(r.milestones) ? r.milestones : []
        const completedCount = milestones.filter(m => completedSet.has(String(m.id ?? m.name ?? ''))).length
        const totalCount = milestones.length || 1
        const pct = Math.round((completedCount / totalCount) * 100)
        return (
          <div key={r.id || idx} className="border border-slate-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-sm text-slate-900 truncate">{r.name || `Race ${idx + 1}`}</h4>
              <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{completedCount}/{totalCount}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${accent}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CalendarColumn({ data }: { data: SidePayload | null }) {
  if (!data) return <p className="text-sm text-slate-400 italic">No calendar data.</p>
  const byDay = groupByDay(data.calendar)
  const days = Object.keys(byDay).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
  if (days.length === 0) return <p className="text-sm text-slate-400 italic">No tasks added yet.</p>
  return (
    <div className="space-y-3">
      {days.map(day => (
        <div key={day}>
          <h4 className="font-semibold text-xs uppercase tracking-wide text-slate-500 mb-1">{day}</h4>
          <ul className="space-y-1">
            {byDay[day].map(t => (
              <li key={t.id} className={`flex items-center justify-between gap-2 px-2 py-1 rounded border text-xs ${PRIORITY_COLOR[t.priority] || 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-slate-700 w-10 flex-shrink-0">{t.time}</span>
                  <span className="font-medium truncate">{t.name}</span>
                </div>
                <span className="text-slate-600 flex-shrink-0">{t.duration}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

export default function ComparePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const friendId = params?.id || ''

  const [me, setMe] = useState<SidePayload | null>(null)
  const [friend, setFriend] = useState<SidePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!friendId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const [profileRes, pathRes, calendarRes, progressRes, friendRes] = await Promise.all([
          fetch('/api/profile', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/me/path', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/me/calendar', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/me/progress', { cache: 'no-store', credentials: 'include' }),
          fetch(`/api/friend/${friendId}`, { cache: 'no-store', credentials: 'include' }),
        ])

        if (cancelled) return

        if (friendRes.status === 403) { setError('You need to be connected with this person to compare.'); return }
        if (friendRes.status === 401 || profileRes.status === 401) { setError('Please sign in to compare.'); return }

        const profileJson = profileRes.ok ? await profileRes.json() : null
        const pathJson = pathRes.ok ? await pathRes.json() : null
        const calendarJson = calendarRes.ok ? await calendarRes.json() : { tasks: [] }
        const progressJson = progressRes.ok ? await progressRes.json() : { progress: [] }
        const friendJson = friendRes.ok ? await friendRes.json() : null

        setMe({
          profile: profileJson?.profile || null,
          path: pathJson?.payload || null,
          calendar: calendarJson.tasks || [],
          progress: progressJson.progress || [],
        })

        if (friendJson?.friend) {
          setFriend({
            profile: friendJson.friend.profile,
            path: friendJson.friend.path,
            calendar: friendJson.friend.calendar || [],
            progress: friendJson.friend.progress || [],
          })
        } else {
          setError('Could not load this friend.')
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [friendId])

  const meCompleted = me ? me.progress.filter(p => p.kind === 'completed').length : 0
  const friendCompleted = friend ? friend.progress.filter(p => p.kind === 'completed').length : 0
  const meTasks = me?.calendar.length || 0
  const friendTasks = friend?.calendar.length || 0
  const meRaces = extractRaces(me?.path).length
  const friendRaces = extractRaces(friend?.path).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-purple-50/30 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          {friend && (
            <Link href={`/friend/${friendId}`} className="text-sm text-indigo-600 hover:text-indigo-700 underline">
              View {friend.profile?.display_name || 'friend'}'s full profile →
            </Link>
          )}
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-1">Side-by-side</h1>
        <p className="text-slate-600 mb-6">See how your pathway, calendar, and progress stack up.</p>

        {loading && (
          <div className="bg-white rounded-2xl p-10 text-center text-slate-500 shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading both pathways…
          </div>
        )}

        {error && !loading && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <p className="text-red-600 font-medium mb-2">{error}</p>
            <Link href="/pit-stop" className="text-purple-600 underline">Back to Pit Stop</Link>
          </div>
        )}

        {!loading && !error && me && friend && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Headers */}
            <div className="bg-white rounded-2xl border-2 border-indigo-300 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{me.profile?.avatar_emoji || '👤'}</div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{me.profile?.display_name || 'You'}</div>
                  <div className="text-xs text-slate-500">You</div>
                </div>
              </div>
              {me.profile?.dream && <p className="text-sm text-slate-600 italic mt-2">“{me.profile.dream}”</p>}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-200">
                <Stat label="races" value={meRaces} />
                <Stat label="done" value={meCompleted} />
                <Stat label="tasks" value={meTasks} />
              </div>
            </div>
            <div className="bg-white rounded-2xl border-2 border-pink-300 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{friend.profile?.avatar_emoji || '👤'}</div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{friend.profile?.display_name || 'Friend'}</div>
                  <div className="text-xs text-slate-500">Friend</div>
                </div>
              </div>
              {friend.profile?.dream && <p className="text-sm text-slate-600 italic mt-2">“{friend.profile.dream}”</p>}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-200">
                <Stat label="races" value={friendRaces} />
                <Stat label="done" value={friendCompleted} />
                <Stat label="tasks" value={friendTasks} />
              </div>
            </div>

            {/* Pathway row */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm md:col-span-2">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-orange-500" />
                Pathway
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <PathwayColumn data={me} accent="bg-indigo-400" />
                <PathwayColumn data={friend} accent="bg-pink-400" />
              </div>
            </div>

            {/* Calendar row */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm md:col-span-2">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                <CalIcon className="w-5 h-5 text-blue-500" />
                Calendar
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <CalendarColumn data={me} />
                <CalendarColumn data={friend} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
