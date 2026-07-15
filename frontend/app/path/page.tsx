'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, TrendingUp, Target, Zap, Heart, Brain, Users, UserCheck, UserPlus, BookOpen, Lock, Loader2, ChevronRight, Settings, Map, Wrench, RotateCcw, Quote, GitCompare, Save } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import LifeStatsCard from '../components/LifeStatsCard'
import { computeRaceProgress, fetchCompletedMilestoneIds, type ProgressMilestone } from '@/lib/raceProgress'
import { saveSnapshot } from '@/lib/pathSnapshots'
import { listServerPaths, activateServerPath, type ServerPathSummary } from '@/lib/serverPaths'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SERVICE_HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'

interface PathData {
  id: string
  userId: string
  path?: any
  races?: any[]
  milestones?: any[]
  recommendations?: any
  schedule?: any[]
  explanations?: string[]
  agentResponses?: any[]
  userProfile?: any
}

export default function PathView() {
  const router = useRouter()
  const { supabaseUser } = useAuth()
  
  const [pathData, setPathData] = useState<PathData | null>(null)
  const [isLoadingPath, setIsLoadingPath] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [completedMilestoneIds, setCompletedMilestoneIds] = useState<Set<string>>(new Set())
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [savedSnapshotName, setSavedSnapshotName] = useState<string | null>(null)
  const [serverPaths, setServerPaths] = useState<ServerPathSummary[]>([])
  const [switchingPath, setSwitchingPath] = useState(false)

  // Reset the current path: clears the locally cached onboarding draft / path
  // seeds and sends the user back through onboarding to build a fresh path.
  const handleResetPath = () => {
    try {
      ;['autinerary_onboarding_draft', 'autinerary_path_seed', 'autinerary_profile'].forEach((k) =>
        localStorage.removeItem(k)
      )
    } catch {
      /* ignore storage errors */
    }
    router.push('/onboarding')
  }
  // Real milestone completions (race_progress) — used to compute how much
  // progress the user has actually made on each race. Refetches when the tab
  // regains focus so returning from the Races page shows fresh numbers.
  useEffect(() => {
    if (!supabaseUser?.id) return
    let cancelled = false
    const load = async () => {
      const ids = await fetchCompletedMilestoneIds()
      if (!cancelled) setCompletedMilestoneIds(ids)
    }
    load()
    const onFocus = () => { load() }
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [supabaseUser?.id])

  // Fetch AI-generated path on mount
  useEffect(() => {
    const fetchPath = async () => {
      const pathId = supabaseUser?.user_metadata?.path_id
      const userId = supabaseUser?.id

      try {
        let response: Response | null = null
        if (pathId) {
          response = await fetch(`${API_URL}/api/onboarding/path/${pathId}`)
        }
        if ((!response || !response.ok) && userId) {
          response = await fetch(`${API_URL}/api/onboarding/user/${userId}/path`)
        }

        if (response && response.ok) {
          const data = await response.json()
          setPathData(data)
        } else if (response) {
          setLoadError('Could not load your path. Using default view.')
        }
      } catch (err) {
        setLoadError('Backend not available. Showing demo path.')
      } finally {
        setIsLoadingPath(false)
      }
    }

    fetchPath()
  }, [supabaseUser])

  // Load the user's saved paths for the multi-path switcher.
  useEffect(() => {
    if (!supabaseUser?.id) return
    let cancelled = false
    listServerPaths(supabaseUser.id).then((paths) => {
      if (!cancelled) setServerPaths(paths)
    })
    return () => { cancelled = true }
  }, [supabaseUser?.id, pathData?.id])

  // Switch the active path and reload it into the view.
  const handleSwitchPath = async (newPathId: string) => {
    const userId = supabaseUser?.id
    if (!userId || !newPathId) return
    setSwitchingPath(true)
    try {
      await activateServerPath(userId, newPathId)
      const res = await fetch(`${API_URL}/api/onboarding/path/${newPathId}`, { cache: 'no-store' })
      if (res.ok) {
        setPathData(await res.json())
        setServerPaths((prev) => prev.map((p) => ({ ...p, isActive: p.pathId === newPathId })))
      }
    } finally {
      setSwitchingPath(false)
    }
  }

  // ── Derive data from AI path or use defaults ──

  const userName = supabaseUser?.user_metadata?.name || supabaseUser?.email?.split('@')[0] || 'Explorer'
  const spiritAnimals = pathData?.userProfile?.spiritAnimals || [
    { type: 'owl', color: 'purple' },
    { type: 'fox', color: 'orange' },
  ]
  const spiritAnimalEmojis: Record<string, string> = {
    owl: '🦉', fox: '🦊', wolf: '🐺', bear: '🐻', eagle: '🦅', dolphin: '🐬',
    lion: '🦁', tiger: '🐯', hawk: '🦅', rabbit: '🐰', deer: '🦌', turtle: '🐢',
  }

  const races = pathData?.races?.length
    ? pathData.races.map((race: any, idx: number) => ({
        id: race.id || `race_${idx + 1}`,
        name: race.name || race.goal || `Goal ${idx + 1}`,
        progress: race.progress || 0,
        category: idx % 2 === 0 ? 'Career' : 'Education',
        color: idx % 2 === 0 ? 'from-cyan-500 to-blue-500' : 'from-purple-500 to-pink-500',
      }))
    : pathData?.userProfile?.goals?.map((goal: string, idx: number) => ({
        id: `race_${idx + 1}`,
        name: goal,
        progress: 0,
        category: idx % 2 === 0 ? 'Career' : 'Education',
        color: idx % 2 === 0 ? 'from-cyan-500 to-blue-500' : 'from-purple-500 to-pink-500',
      })) || [
        { id: 'race_1', name: 'Graduate University', progress: 45, category: 'Education', color: 'from-purple-500 to-pink-500' },
        { id: 'race_2', name: 'Get Tech Job', progress: 20, category: 'Career', color: 'from-cyan-500 to-blue-500' },
      ]

  // ── Real progress ─────────────────────────────────────────────────
  // Replace each race's progress with the % of its milestones the user has
  // actually completed. Milestones come from the stored path payload; a race
  // with no attributable milestones keeps its payload value.
  const pathMilestones: ProgressMilestone[] =
    (pathData?.milestones || pathData?.path?.milestones || []) as ProgressMilestone[]
  races.forEach((r: any) => {
    const p = computeRaceProgress(r, pathMilestones, completedMilestoneIds)
    if (p !== null) r.progress = p
  })

  const ultimateDream = pathData?.userProfile?.ultimateDream || 'Become a successful professional who thrives with my unique strengths'
  const overallProgress = races.length > 0
    ? Math.round(races.reduce((sum: number, r: any) => sum + r.progress, 0) / races.length)
    : 0

  // ── Motivational quote (Madhu) ──────────────────────────────────────
  // A quote tuned to how the journey is going right now (a light proxy for
  // "how the person is feeling"), so the Path always opens with encouragement.
  const motivationalQuote = (() => {
    if (overallProgress === 0) {
      const start = [
        'Every big journey begins with one small step. You\u2019ve got this.',
        'The start is the hardest part — and you\u2019re already here.',
        'You don\u2019t have to be great to start, but you have to start to be great.',
      ]
      return start[new Date().getDate() % start.length]
    }
    if (overallProgress < 40) {
      const early = [
        'Progress, not perfection. Keep going at your own pace.',
        'Small steps every day add up to big change.',
        'You\u2019re building momentum — one milestone at a time.',
      ]
      return early[new Date().getDate() % early.length]
    }
    if (overallProgress < 80) {
      const mid = [
        'You\u2019re over the hump — look how far you\u2019ve come.',
        'Halfway is a milestone worth celebrating. Keep it up!',
        'Consistency is your superpower. Stay the course.',
      ]
      return mid[new Date().getDate() % mid.length]
    }
    const near = [
      'The finish line is in sight — finish strong!',
      'You\u2019re so close. Your future self is cheering you on.',
      'Almost there. Every step now counts double.',
    ]
    return near[new Date().getDate() % near.length]
  })()

  // Group races by category
  const careerRaces = races.filter((r: any) => r.category === 'Career')
  const educationRaces = races.filter((r: any) => r.category === 'Education')

  const roleModels = [
    { id: 'rm1', name: 'Sarah Chen', role: 'Software Engineer', initials: 'SC' },
    { id: 'rm2', name: 'Marcus Johnson', role: 'Entrepreneur', initials: 'MJ' },
  ]
  const mentors = [
    { id: 'm1', name: 'James Wilson', role: 'Career Coach', initials: 'JW' },
    { id: 'm2', name: 'Lisa Park', role: 'Academic Advisor', initials: 'LP' },
  ]
  const friendsFam = [
    { id: 'f1', name: 'Alex Taylor', role: 'Study Buddy', initials: 'AT' },
  ]

  // Loading state
  if (isLoadingPath) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-500" />
        <p className="text-slate-600 font-medium">Loading your path...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Snapshot saved toast */}
        {savedSnapshotName && (
          <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <Save className="w-4 h-4 text-cyan-300" />
            Saved &ldquo;{savedSnapshotName}&rdquo; —{' '}
            <Link href="/paths/compare" className="underline font-medium">Compare</Link>
          </div>
        )}

        {/* Reset confirmation */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-bold text-slate-800">Reset your path?</h3>
              </div>
              <p className="text-sm text-slate-600 mb-5">
                This clears your saved onboarding answers on this device and restarts onboarding so
                you can build a fresh path. Your existing saved path stays until you complete a new one.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPath}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg"
                >
                  Reset path
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error banner */}
        {loadError && (
          <div className="mb-4 bg-slate-50 border border-slate-200 text-slate-500 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
            <span className="text-slate-400">ℹ️</span> {loadError}
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Spirit Animals */}
            <div className="flex -space-x-2">
              {spiritAnimals.slice(0, 2).map((animal: any, idx: number) => (
                <div
                  key={idx}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-white shadow-md flex items-center justify-center text-2xl"
                  title={`${idx === 0 ? 'Fast Day' : 'Slow Day'}: ${animal.type}`}
                >
                  {spiritAnimalEmojis[animal.type] || '🐾'}
                </div>
              ))}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{userName}&apos;s Path</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-slate-500">Your journey snapshot</p>
                {pathData && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                    <Sparkles className="w-3 h-3" /> AI-Generated
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const snap = saveSnapshot(`${userName}'s Path — ${new Date().toLocaleDateString()}`, {
                  ultimateDream,
                  races: races.map((r: any) => ({ id: r.id, name: r.name, progress: r.progress, category: r.category })),
                  milestones: pathMilestones.map((m: any) => ({ id: m.id, name: m.name })),
                  goals: pathData?.userProfile?.goals || [],
                })
                setSavedSnapshotName(snap.name)
                setTimeout(() => setSavedSnapshotName(null), 3000)
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-cyan-700 border border-slate-300 rounded-lg hover:bg-white hover:border-cyan-300 transition-all"
              title="Save this path as a snapshot to compare later"
            >
              <Save className="w-4 h-4" />
              Save snapshot
            </button>
            <Link
              href="/paths/compare"
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-purple-700 border border-slate-300 rounded-lg hover:bg-white hover:border-purple-300 transition-all"
            >
              <GitCompare className="w-4 h-4" />
              Compare
            </Link>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-red-600 border border-slate-300 rounded-lg hover:bg-white hover:border-red-300 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={() => router.push('/onboarding')}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-white transition-all"
              title="Edit your answers. Your progress and saved path are kept — use Reset to start over."
            >
              <Settings className="w-4 h-4" />
              Customize
            </button>
          </div>
        </div>

        {/* ── Multi-path switcher (only when the user has more than one) ── */}
        {serverPaths.length > 1 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <GitCompare className="w-4 h-4 text-purple-500" /> Your paths
            </span>
            <select
              value={pathData?.id || ''}
              disabled={switchingPath}
              onChange={(e) => handleSwitchPath(e.target.value)}
              className="text-sm bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
            >
              {serverPaths.map((p) => (
                <option key={p.pathId} value={p.pathId}>
                  {p.label}{p.isActive ? ' (active)' : ''} — {p.overallProgress}%
                </option>
              ))}
            </select>
            {switchingPath && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            <Link href="/paths/compare" className="text-xs font-medium text-purple-600 hover:text-purple-700 ml-auto inline-flex items-center gap-1">
              Compare all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* ── Motivational quote (mood-aware) ── */}
        <div className="mb-6 bg-gradient-to-r from-purple-50 via-cyan-50 to-purple-50 border border-purple-100 rounded-2xl px-5 py-4 flex items-start gap-3">
          <Quote className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700 italic">{motivationalQuote}</p>
        </div>

        {/* ── 2x2 Dashboard Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          {/* ── Card 1: Races ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-500" />
              Races
            </h2>

            {/* Ultimate Dream & Overall */}
            <div className="bg-gradient-to-r from-cyan-50 to-purple-50 rounded-xl p-4 mb-4 border border-slate-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ultimate Dream</p>
                  <p className="text-sm text-slate-800 font-medium mt-0.5 line-clamp-2">{ultimateDream}</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Overall Progress</span>
                  <span className="font-bold text-cyan-600">{overallProgress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all" style={{ width: `${overallProgress}%` }} />
                </div>
              </div>
            </div>

            {/* Career Races */}
            {careerRaces.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Career Race(s)</p>
                {careerRaces.map((race: any) => (
                  <Link key={race.id} href="/races" className="block mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-slate-700">{race.name}</span>
                      <span className="text-xs font-bold text-cyan-600">{race.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${race.color} rounded-full`} style={{ width: `${race.progress}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Education Races */}
            {educationRaces.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Education Race(s)</p>
                {educationRaces.map((race: any) => (
                  <Link key={race.id} href="/races" className="block mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-slate-700">{race.name}</span>
                      <span className="text-xs font-bold text-purple-600">{race.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${race.color} rounded-full`} style={{ width: `${race.progress}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <Link href="/races" className="flex items-center justify-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 font-medium mt-2 py-2 rounded-lg hover:bg-cyan-50 transition-colors">
              See all races&apos; progress <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* ── Card 2: Life Stats ── */}
          <LifeStatsCard />

          {/* ── Card 3: Your People (Hare World) ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Your People
            </h2>

            {/* Role Models */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Role Models</p>
              <div className="flex gap-3">
                {roleModels.map((rm) => (
                  <div key={rm.id} className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-xs font-bold text-white">
                      {rm.initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-tight">{rm.name}</p>
                      <p className="text-xs text-slate-500">{rm.role}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center text-slate-400 text-sm">...</div>
              </div>
            </div>

            {/* Mentors */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mentors</p>
              <div className="flex gap-3">
                {mentors.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 bg-cyan-50 rounded-lg px-3 py-2 border border-cyan-100">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-400 flex items-center justify-center text-xs font-bold text-white">
                      {m.initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-tight">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.role}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center text-slate-400 text-sm">...</div>
              </div>
            </div>

            {/* Friends/Fam */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Friends / Family</p>
              <div className="flex gap-3">
                {friendsFam.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 bg-pink-50 rounded-lg px-3 py-2 border border-pink-100">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-xs font-bold text-white">
                      {f.initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-tight">{f.name}</p>
                      <p className="text-xs text-slate-500">{f.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/pit-stop?tab=haveworld&view=people" className="flex items-center justify-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium mt-2 py-2 rounded-lg hover:bg-purple-50 transition-colors">
              See all people <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* ── Card 4: Your Resources ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              Your Resources
            </h2>

            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-100 to-purple-100 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-cyan-500" />
              </div>
              <p className="text-sm text-slate-600 mb-1 font-medium">Same as ResourceHub</p>
              <p className="text-xs text-slate-400 mb-4 max-w-[250px]">
                Your saved resources, community-rated services, and AI recommendations — all in one place.
              </p>
            </div>

            <a
              href={SERVICE_HUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 font-medium py-2 rounded-lg hover:bg-cyan-50 transition-colors"
            >
              See all resources <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* ── Quick Actions Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Link href="/races" className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            <Target className="w-4 h-4 text-cyan-500" />
            Races
          </Link>
          <Link href="/pit-stop?tab=haveworld" className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            <Wrench className="w-4 h-4 text-purple-500" />
            Pit Stop
          </Link>
          <Link href="/stats" className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Stats Breakdown
          </Link>
          <Link href="/reflection?contextType=path" className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            <BookOpen className="w-4 h-4 text-amber-500" />
            Journal
          </Link>
          <a
            href={`${SERVICE_HUB_URL.replace(/\/$/, '')}/community?from=hare-world&context=path`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-emerald-500" />
            View related posts
          </a>
          <Link href="/resource-roadmap" className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            <Map className="w-4 h-4 text-cyan-500" />
            Resource Roadmap
          </Link>
          <Link href="/path-market" className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            <Sparkles className="w-4 h-4 text-purple-500" />
            Path Market
          </Link>
        </div>

        {/* ── Unlock Multi-Path Management ── */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Unlock Multi-Path Management</h3>
                <p className="text-sm text-slate-400">
                  For Mentors, Employers, Educators &amp; Parents — manage multiple paths in one place.
                </p>
              </div>
            </div>
            <button className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-semibold rounded-xl hover:shadow-lg transition-all text-sm whitespace-nowrap">
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
