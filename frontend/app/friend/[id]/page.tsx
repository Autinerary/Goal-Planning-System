'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy, Calendar as CalIcon, Sparkles, Send, X, CheckCircle2, Link as LinkIcon, MessageSquare, Loader2 } from 'lucide-react'

interface Profile {
  id: string
  display_name: string | null
  avatar_emoji: string | null
  dream: string | null
  email: string | null
}

interface CalendarTask {
  id: string
  client_id: string
  day: string
  time: string
  name: string
  duration: string
  priority: string
  source: string | null
  scenario: string | null
  completed: boolean
}

interface ProgressRow {
  milestone_id: string
  kind: 'completed' | 'hearted'
  completed_at: string
}

interface FriendBundle {
  id: string
  category: string
  connection_id: string
  profile: Profile | null
  path: any | null
  path_updated_at: string | null
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

export default function FriendProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const friendId = params?.id || ''

  const [bundle, setBundle] = useState<FriendBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Suggest modal
  const [showSuggest, setShowSuggest] = useState(false)
  const [sName, setSName] = useState('')
  const [sUrl, setSUrl] = useState('')
  const [sNote, setSNote] = useState('')
  const [sSending, setSSending] = useState(false)
  const [sError, setSError] = useState<string | null>(null)
  const [sSent, setSSent] = useState(false)

  useEffect(() => {
    if (!friendId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/friend/${friendId}`, { cache: 'no-store', credentials: 'include' })
        if (cancelled) return
        if (res.status === 401) { setError('Please sign in to view this profile.'); return }
        if (res.status === 403) { setError('You need to be connected with this person to view their profile.'); return }
        if (!res.ok) {
          const j = await res.json().catch(() => null)
          setError(j?.error || `Could not load friend (${res.status})`)
          return
        }
        const json = await res.json()
        setBundle(json.friend)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [friendId])

  const sendSuggestion = async () => {
    setSError(null)
    if (!sName.trim()) { setSError('Resource name is required'); return }
    setSSending(true)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to_user_id: friendId,
          name: sName.trim(),
          url: sUrl.trim() || null,
          note: sNote.trim() || null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setSError(json?.error || `Failed (${res.status})`)
        return
      }
      setSSent(true)
      setSName(''); setSUrl(''); setSNote('')
      setTimeout(() => { setShowSuggest(false); setSSent(false) }, 1600)
    } catch (e: any) {
      setSError(e?.message || 'Network error')
    } finally {
      setSSending(false)
    }
  }

  const completedSet = new Set((bundle?.progress || []).filter(p => p.kind === 'completed').map(p => p.milestone_id))

  // Try to extract a simple races list from the agent payload shape.
  // We accept either bundle.path.races OR bundle.path.path?.races as common shapes.
  const friendRaces: any[] = (() => {
    const p = bundle?.path
    if (!p) return []
    if (Array.isArray(p.races)) return p.races
    if (Array.isArray(p?.path?.races)) return p.path.races
    return []
  })()

  // Derive a simple list of milestone-like items so we can show "completed" badges
  const friendMilestones: { id: string; name: string; raceName?: string }[] = []
  for (const r of friendRaces) {
    if (Array.isArray(r.milestones)) {
      for (const m of r.milestones) {
        friendMilestones.push({ id: String(m.id ?? m.name ?? ''), name: String(m.name ?? m.title ?? 'Milestone'), raceName: r.name })
      }
    }
  }

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const calendarByDay = (bundle?.calendar || []).reduce<Record<string, CalendarTask[]>>((acc, t) => {
    ;(acc[t.day] ||= []).push(t)
    return acc
  }, {})
  const calendarDays = Object.keys(calendarByDay).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50/30 to-amber-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          {bundle && (
            <Link
              href={`/compare/${friendId}`}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Compare side-by-side
            </Link>
          )}
        </div>

        {loading && (
          <div className="bg-white rounded-2xl p-10 text-center text-slate-500 shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading friend…
          </div>
        )}

        {error && !loading && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <p className="text-red-600 font-medium mb-2">{error}</p>
            <Link href="/pit-stop" className="text-purple-600 underline">Back to Pit Stop</Link>
          </div>
        )}

        {bundle && !loading && (
          <>
            {/* Profile card */}
            <div className="bg-white rounded-2xl border-2 border-purple-200 p-6 shadow-sm mb-6">
              <div className="flex items-start gap-4">
                <div className="text-6xl">{bundle.profile?.avatar_emoji || '👤'}</div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-slate-900 truncate">
                    {bundle.profile?.display_name || 'Unnamed friend'}
                  </h1>
                  <p className="text-sm text-slate-500 mb-2">
                    {bundle.category === 'rolemodels' ? 'Role Model' : bundle.category === 'mentors' ? 'Mentor' : 'Friend'}
                  </p>
                  {bundle.profile?.dream ? (
                    <p className="text-slate-700 italic mb-3">“{bundle.profile.dream}”</p>
                  ) : (
                    <p className="text-slate-400 italic mb-3">No dream shared yet.</p>
                  )}
                </div>
                <button
                  onClick={() => setShowSuggest(true)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg flex items-center gap-2 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                  Suggest a resource
                </button>
              </div>
            </div>

            {/* Pathway / races */}
            <div className="bg-white rounded-2xl border-2 border-orange-200 p-6 shadow-sm mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-orange-500" />
                Their pathway
              </h2>
              {friendRaces.length === 0 ? (
                <p className="text-sm text-slate-500">
                  This person hasn’t generated a pathway yet, or hasn’t made one visible.
                </p>
              ) : (
                <div className="space-y-4">
                  {friendRaces.map((r: any, idx: number) => {
                    const milestones: any[] = Array.isArray(r.milestones) ? r.milestones : []
                    const completedCount = milestones.filter(m => completedSet.has(String(m.id ?? m.name ?? ''))).length
                    const totalCount = milestones.length || 1
                    const pct = Math.round((completedCount / totalCount) * 100)
                    return (
                      <div key={r.id || idx} className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-slate-900">{r.name || `Race ${idx + 1}`}</h3>
                          <span className="text-xs text-slate-500">{completedCount}/{totalCount} milestones</span>
                        </div>
                        {r.goal && <p className="text-sm text-slate-600 mb-3">{r.goal}</p>}
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                          <div className="h-full bg-orange-400" style={{ width: `${pct}%` }} />
                        </div>
                        {milestones.length > 0 && (
                          <ul className="space-y-1">
                            {milestones.map((m: any) => {
                              const mid = String(m.id ?? m.name ?? '')
                              const done = completedSet.has(mid)
                              return (
                                <li key={mid} className="text-sm flex items-center gap-2">
                                  {done ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                  ) : (
                                    <span className="w-4 h-4 border-2 border-slate-300 rounded-full flex-shrink-0" />
                                  )}
                                  <span className={done ? 'text-slate-500 line-through' : 'text-slate-800'}>
                                    {m.name || m.title || 'Milestone'}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-sm mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CalIcon className="w-5 h-5 text-blue-500" />
                Their calendar
              </h2>
              {calendarDays.length === 0 ? (
                <p className="text-sm text-slate-500">No calendar tasks added yet.</p>
              ) : (
                <div className="space-y-4">
                  {calendarDays.map(day => (
                    <div key={day}>
                      <h3 className="font-semibold text-slate-800 mb-2">{day}</h3>
                      <ul className="space-y-1">
                        {calendarByDay[day].map(t => (
                          <li key={t.id} className={`flex items-center justify-between gap-3 p-2 rounded-lg border ${PRIORITY_COLOR[t.priority] || 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs font-mono text-slate-700 w-12 flex-shrink-0">{t.time}</span>
                              <span className="text-sm font-medium truncate">{t.name}</span>
                            </div>
                            <span className="text-xs text-slate-600 flex-shrink-0">{t.duration}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Suggest a resource modal */}
        {showSuggest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Send className="w-5 h-5 text-emerald-500" />
                  Suggest a resource
                </h3>
                <button onClick={() => { setShowSuggest(false); setSError(null); setSSent(false) }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {sSent ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <p className="font-medium text-slate-800">Sent!</p>
                  <p className="text-sm text-slate-500">They’ll see it in their inbox.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Pass a ResourceHub link, a service, a tool — anything you think would help{bundle?.profile?.display_name ? ` ${bundle.profile.display_name}` : ''}.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Resource name *
                      </label>
                      <input
                        value={sName}
                        onChange={e => setSName(e.target.value.slice(0, 160))}
                        placeholder="e.g. Focusmate Body Doubling"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" /> URL (optional)
                      </label>
                      <input
                        value={sUrl}
                        onChange={e => setSUrl(e.target.value.slice(0, 500))}
                        placeholder="https://…"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Why are you suggesting it? (optional)</label>
                      <textarea
                        value={sNote}
                        onChange={e => setSNote(e.target.value.slice(0, 500))}
                        rows={3}
                        placeholder="It helped me get unstuck on my first race…"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                      />
                    </div>
                  </div>
                  {sError && (
                    <p className="text-xs text-red-600 mt-3 bg-red-50 border border-red-200 rounded px-3 py-2">{sError}</p>
                  )}
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setShowSuggest(false)}
                      className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendSuggestion}
                      disabled={sSending}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg flex items-center gap-2"
                    >
                      {sSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send suggestion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
