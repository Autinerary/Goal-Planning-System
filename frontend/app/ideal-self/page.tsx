'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Target, Users, Wand2, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'
import { useAuth } from '../context/AuthContext'

type Portrait = { imageUrl: string; prompt?: string; style?: string; updatedAt?: string }
type Stat = { name: string; value: number; max: number }

const STYLES = [
  { key: 'painterly', label: '🎨 Painterly' },
  { key: 'watercolor', label: '💧 Watercolor' },
  { key: 'anime', label: '✨ Anime' },
  { key: 'photoreal', label: '📷 Cinematic' },
]

export default function IdealSelfPage() {
  const router = useRouter()
  const { payload } = useAgentPath()
  const { supabaseUser } = useAuth()
  const isSignedIn = Boolean(supabaseUser)

  const dreams: string[] = (payload?.userProfile?.dreams || []) as string[]
  const goals: string[] = (payload?.userProfile?.goals || []) as string[]
  const barriers: string[] = (payload?.userProfile?.barrierTypes || []) as string[]
  const dreamHeadline = dreams[0] || 'Cloud 9 — Your ideal future'

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
        setStats([
          { name: 'Mentality', value: j.stats.mentality.value, max: 10 },
          { name: 'Happiness', value: j.stats.happiness.value, max: 10 },
          { name: 'Focus', value: j.stats.focus.value, max: 10 },
          { name: 'Energy', value: j.stats.energy.value, max: 10 },
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
  const [style, setStyle] = useState('painterly')
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isSignedIn) { setLoadingSaved(false); return }
      try {
        const res = await fetch('/api/me/ideal-self', { cache: 'no-store', credentials: 'include' })
        if (res.ok) {
          const j = await res.json()
          if (cancelled) return
          if (j?.portrait) { setPortrait(j.portrait); if (j.portrait.style) setStyle(j.portrait.style) }
          setHasApiKey(Boolean(j?.hasApiKey))
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingSaved(false)
      }
    })()
    return () => { cancelled = true }
  }, [isSignedIn])

  const generate = async () => {
    if (generating) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/me/ideal-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dreams, goals, barriers, style }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Flipping hasApiKey already swaps the button for the amber banner
        // that says exactly this. Setting `error` too printed the same
        // sentence twice — once amber, once red.
        if (j?.code === 'no_api_key') { setHasApiKey(false); setError(null) }
        else setError(j?.error || 'Generation failed. Please try again.')
        return
      }
      if (j?.portrait) setPortrait(j.portrait)
      if (j?.saved === false) setError('Generated, but couldn\u2019t save it to your profile.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-sky-100/90 backdrop-blur-md border-b border-sky-200 px-4 py-2">
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <button onClick={() => router.back()} className="p-1 rounded-lg hover:opacity-70 text-slate-800">
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
          {/* ④ AI-generated portrait — spans both columns on top for prominence */}
          <div className="lg:col-span-2 bg-white/70 backdrop-blur border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="w-5 h-5 text-purple-500" />
              <h3 className="font-bold text-slate-800">AI Portrait of Your Ideal Self</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-5 items-start">
              {/* Image / placeholder */}
              <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-b from-sky-50 to-purple-50 flex items-center justify-center">
                {generating ? (
                  <div className="flex flex-col items-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span className="text-xs">Painting your future self…</span>
                  </div>
                ) : portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={portrait.imageUrl} alt="AI-generated portrait of your ideal self" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-slate-400 px-4 text-center">
                    <Sparkles className="w-8 h-8 mb-2" />
                    <span className="text-xs">Your portrait will appear here</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div>
                <p className="text-xs text-slate-600 mb-3">
                  Generate an inspiring, symbolic portrait of the person you’re growing into — shaped by your dreams and goals.
                </p>

                <div className="mb-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Style</div>
                  <div className="flex flex-wrap gap-1.5">
                    {STYLES.map(s => (
                      <button
                        key={s.key}
                        onClick={() => setStyle(s.key)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                          style === s.key ? 'bg-slate-800 text-white border-slate-800' : 'bg-white/70 text-slate-600 border-slate-200 hover:bg-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!isSignedIn ? (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Sign in to generate and save your portrait.</span>
                  </div>
                ) : !hasApiKey ? (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Portrait generation isn’t configured yet (missing OpenAI key).</span>
                  </div>
                ) : (
                  <button
                    onClick={generate}
                    disabled={generating}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 shadow hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : portrait ? <RefreshCw className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                    {generating ? 'Generating…' : portrait ? 'Regenerate' : 'Generate portrait'}
                  </button>
                )}

                {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
                {portrait?.updatedAt && !generating && (
                  <div className="mt-2 text-[10px] text-slate-400">Last updated {new Date(portrait.updatedAt).toLocaleDateString()}</div>
                )}
              </div>
            </div>
          </div>

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
