'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Target, Users, Loader2 } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'
import { useAuth } from '../context/AuthContext'
import AvatarEditor from '../components/AvatarEditor'
import { usePreferences } from '../context/usePreferences'
import { DEFAULT_HAIR_COLOR, DEFAULT_SKIN_TONE } from '@/lib/avatar'

type Portrait = { imageUrl: string; prompt?: string; style?: string; updatedAt?: string }
// value is null when the API has no signal for that stat yet. The bar
// renders as a dash rather than an empty-but-scored-looking zero.
type Stat = { name: string; value: number | null; max: number }

export default function IdealSelfPage() {
  const router = useRouter()
  const { payload } = useAgentPath()
  const { supabaseUser } = useAuth()
  const isSignedIn = Boolean(supabaseUser)
  const { prefs, update } = usePreferences()
  const defaultAppearance = { hairStyle: 'short_straight', hairColor: DEFAULT_HAIR_COLOR, skinColor: DEFAULT_SKIN_TONE }
  const persona = prefs.alternatePersona || { name: '', note: '', appearance: defaultAppearance }

  const dreams: string[] = (payload?.userProfile?.dreams || []) as string[]
  const goals: string[] = (payload?.userProfile?.goals || []) as string[]
  const barriers: string[] = (payload?.userProfile?.barrierTypes || []) as string[]
  const dreamHeadline = dreams[0] || 'Cloud 9: Your ideal future'

  // Role models / influences — real data only.
  //
  // These used to fall back to invented people ('Sarah C.', 'Marcus J.',
  // 'James W.', 'Lisa P.'), and 'Alex T.' was not even conditional — every
  // user was shown a friend who does not exist. On a page about the person
  // you are growing into, inventing your support network is the worst
  // possible place to put placeholder data.
  const roleModels: string[] = (payload?.userProfile?.roleModels || []) as string[]
  const mentors: string[] = (payload?.userProfile?.mentors || []) as string[]
  const friends: string[] = (payload?.userProfile?.friends || []) as string[]
  const influences = { roleModels, mentors, friends }
  const hasInfluences = roleModels.length + mentors.length + friends.length > 0

  // Stats from the real life-stats loader (signed-in only).
  //
  // These used to initialise at 5/10 across the board. That is a made-up
  // number rendered exactly like a measured one — a signed-out user, or
  // anyone whose fetch failed, saw four filled bars implying we had scored
  // them. Null means "not loaded"; the UI shows empty bars and says so.
  const [stats, setStats] = useState<Stat[] | null>(null)
  const [statsFailed, setStatsFailed] = useState(false)
  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me/life-stats', { cache: 'no-store', credentials: 'include' })
        if (!res.ok) { if (!cancelled) setStatsFailed(true); return }
        const j = await res.json()
        if (cancelled) return
        if (!j?.stats) { setStatsFailed(true); return }
        // Any stat the API returns as null has no data behind it. Pass the
        // null straight through — the bar below already renders "—" for it.
        const val = (raw: any): number | null =>
          raw && typeof raw.value === 'number' ? raw.value : null
        setStats([
          { name: 'Mentality', value: val(j.stats.mentality), max: 10 },
          { name: 'Happiness', value: val(j.stats.happiness), max: 10 },
          { name: 'Focus', value: val(j.stats.focus), max: 10 },
          { name: 'Energy', value: val(j.stats.energy), max: 10 },
        ])
      } catch {
        if (!cancelled) setStatsFailed(true)
      }
    })()
    return () => { cancelled = true }
  }, [isSignedIn])

  // Names only, so the card keeps its shape while the real values load.
  const STAT_NAMES = ['Mentality', 'Happiness', 'Focus', 'Energy']

  // Portrait state.
  const [portrait, setPortrait] = useState<Portrait | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isSignedIn) { setLoadingSaved(false); return }
      try {
        const res = await fetch('/api/me/ideal-self', { cache: 'no-store', credentials: 'include' })
        if (res.ok) {
          const j = await res.json()
          if (cancelled) return
          if (j?.portrait) setPortrait(j.portrait)
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingSaved(false)
      }
    })()
    return () => { cancelled = true }
  }, [isSignedIn])

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-sky-100/90 backdrop-blur-md border-b border-sky-200 px-4 py-2">
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-slate-900/10 text-slate-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">✨ Ideal Self</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-2">🧑‍🚀</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-transparent">Your Dream Self</h2>
          <p className="text-slate-600 text-sm mt-1">{dreamHeadline}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="lg:col-span-2 grid gap-6 sm:grid-cols-2 py-5">
            <AvatarEditor title="Dream Self appearance" value={prefs.dreamAppearance || defaultAppearance} onChange={appearance => update({ dreamAppearance: appearance })} />
            <div className="space-y-4">
              <label className="block text-sm font-medium">Alternate Persona name
                <input value={persona.name} maxLength={60} onChange={event => update({ alternatePersona: { ...persona, name: event.target.value } })} className="mt-2 block w-full rounded-lg border bg-white p-2" />
              </label>
              <label className="block text-sm font-medium">About your Alternate Persona
                <textarea value={persona.note} maxLength={400} onChange={event => update({ alternatePersona: { ...persona, note: event.target.value } })} className="mt-2 block w-full rounded-lg border bg-white p-2" />
              </label>
              <AvatarEditor title="Alternate Persona appearance" value={persona.appearance} onChange={appearance => update({ alternatePersona: { ...persona, appearance } })} />
            </div>
            {portrait && <details className="sm:col-span-2">
              <summary className="cursor-pointer text-sm">Previously saved portrait</summary>
              <img src={portrait.imageUrl} alt="Previously saved Dream Self portrait" className="mt-3 aspect-square w-48 object-cover" />
            </details>}
          </section>

          {/* ① Role Models / Influences */}
          <div className="bg-white/70 backdrop-blur border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-purple-500" />
              <h3 className="font-bold text-slate-800">Role Models & Influences</h3>
            </div>
            {hasInfluences ? (
              <div className="space-y-3">
                {influences.roleModels.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Role Models</div>
                    <div className="flex flex-wrap gap-1.5">
                      {influences.roleModels.map(n => <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{n}</span>)}
                    </div>
                  </div>
                )}
                {influences.mentors.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Mentors</div>
                    <div className="flex flex-wrap gap-1.5">
                      {influences.mentors.map(n => <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">{n}</span>)}
                    </div>
                  </div>
                )}
                {influences.friends.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Friends &amp; Family</div>
                    <div className="flex flex-wrap gap-1.5">
                      {influences.friends.map(n => <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">{n}</span>)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Empty is honest. Inventing names here would be telling someone
                 who their mentors are. */
              <p className="text-sm text-slate-500">
                No one added yet. The people who inspire and support you will show up here
                once you add them in Hare World.
              </p>
            )}
            <Link href="/pit-stop?tab=haveworld&view=people" className="inline-block mt-4 text-xs font-semibold text-purple-600 hover:underline">
              See all people in Hare World →
            </Link>
          </div>

          {/* ② Goals */}
          <div className="bg-white/70 backdrop-blur border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-sky-500" />
              <h3 className="font-bold text-slate-800">Goals</h3>
            </div>
            {goals.length ? (
              <ul className="space-y-2">
                {goals.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 text-sky-500">🎯</span>
                    <span className="text-sm text-slate-700 font-medium">{g}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">
                No goals yet.{' '}
                <Link href="/onboarding?step=3" className="text-sky-600 font-semibold hover:underline">Add one →</Link>
              </div>
            )}
            {barriers.length > 0 && (
              <div className="mt-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Navigating</div>
                <div className="flex flex-wrap gap-1.5">
                  {barriers.slice(0, 6).map(b => <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{b}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* ③ Stats */}
          <div className="lg:col-span-2 bg-white/70 backdrop-blur border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-800">Stats</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(stats || STAT_NAMES.map(name => ({ name, value: null as number | null, max: 10 }))).map((s, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{s.name}</span>
                    <span className="text-xs font-bold text-slate-800">
                      {s.value === null ? <span className="text-slate-300">—</span> : `${s.value} XP`}
                    </span>
                  </div>
                  <div className="h-2 bg-sky-100 rounded-full overflow-hidden">
                    {s.value !== null && (
                      <div className={`h-full rounded-full ${s.value >= 7 ? 'bg-sky-400' : 'bg-indigo-400'}`} style={{ width: `${(s.value / s.max) * 100}%` }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!isSignedIn ? (
              <div className="mt-3 text-[11px] text-slate-400">Sign in to see your live stats.</div>
            ) : statsFailed ? (
              <div className="mt-3 text-[11px] text-slate-400">Couldn&apos;t load your stats just now.</div>
            ) : !stats ? (
              <div className="mt-3 text-[11px] text-slate-400">Loading your stats…</div>
            ) : stats.every((s) => s.value === null) ? (
              <div className="mt-3 text-[11px] text-slate-400">
                No stats yet. Check in with your mood or complete a milestone to start them off.
              </div>
            ) : null}
          </div>
        </div>

        {loadingSaved && (
          <div className="mt-4 flex items-center justify-center text-slate-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your Ideal Self…
          </div>
        )}
      </div>
    </div>
  )
}
