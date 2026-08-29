'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ChevronDown, ChevronUp, ExternalLink, ArrowLeft, Users, UserCheck, UserPlus, Bell, Trophy, RefreshCw, Filter, X, Info, AlertTriangle, Send, MessageSquare, Eye, Loader2 } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'
import { useAuth } from '../context/AuthContext'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import { computeRaceProgress } from '@/lib/raceProgress'
import { goHubHref } from '@/lib/serviceHub'
import { usePreferences } from '../context/usePreferences'
import MilestoneTrail from '../components/MilestoneTrail'

/*
  DREAM LAND — One continuous race-track roadmap.
  Roads are HTML elements IN the document flow (not a background SVG),
  so they always stay connected to the content.
  Pit Stop Shop opens ServiceHub. Milestone sign is a signboard.
*/

function RacesContent() {
  const { payload, pathPlanning, toolRecommendation, loading } = useAgentPath()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { prefs, updateLayout } = usePreferences()

  const [isDayTheme, setIsDayTheme] = useState(true)
  const [showRocketEntry, setShowRocketEntry] = useState(false)
  const [rocketPhase, setRocketPhase] = useState<'flying' | 'landing' | 'landed'>('landed')
  const comparisonView = searchParams.get('compare') || null
  const newView = searchParams.get('newview') || null
  const [showPreviousSteps, setShowPreviousSteps] = useState(false)
  const [isWheelSpinning, setIsWheelSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [todaysMotivation, setTodaysMotivation] = useState<string | null>(null)
  const [showCompareMenu, setShowCompareMenu] = useState(false)
  const [showNewViewsMenu, setShowNewViewsMenu] = useState(false)
  const [suggestionFilter, setSuggestionFilter] = useState<string>('All')
  const [expandShop, setExpandShop] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')
  const [sentSuggestions, setSentSuggestions] = useState<{ to: string; text: string }[]>([])
  const [gamifiedMode, setGamifiedMode] = useState(true)
  const [showPinwheelPopup, setShowPinwheelPopup] = useState(false)
  const [pinwheelHover, setPinwheelHover] = useState(false)
  const [activeDimension, setActiveDimension] = useState('education')
  const [activeDimRace, setActiveDimRace] = useState<string | null>(null)
  const [dimViewMode, setDimViewMode] = useState<'individual' | 'combined'>('individual')
  // "Choose your next path" prompts the user has dismissed (by completed step id).
  const [dismissedBranches, setDismissedBranches] = useState<Set<string>>(new Set())
  const [layoutMode, setLayoutMode] = useState<'track' | 'list'>('list')
  // 'trail' is the level-map view — the whole path as a set of zones you
  // move through, rather than the five-stop road. Default, because seeing
  // progress spatially is the point of the race framing in the first place.
  const [trackShape, setTrackShape] = useState<'trail' | 'one' | 'separate'>('trail')
  const [completedMilestoneIds, setCompletedMilestoneIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try { const s = localStorage.getItem('completedMilestoneIds'); return s ? new Set(JSON.parse(s)) : new Set() } catch { return new Set() }
    }
    return new Set()
  })
  const [heartedGoals, setHeartedGoals] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try { const s = localStorage.getItem('heartedGoals'); return s ? new Set(JSON.parse(s)) : new Set() } catch { return new Set() }
    }
    return new Set()
  })
  const [showNextMilestoneSelect, setShowNextMilestoneSelect] = useState(false)
  // Extra barriers the user adds directly on the Race checklist view (Odosa's
  // "Add here" arrow). Persisted locally and merged with onboarding barriers.
  const [extraBarriers, setExtraBarriers] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { const s = localStorage.getItem('raceExtraBarriers'); return s ? JSON.parse(s) : [] } catch { return [] }
    }
    return []
  })
  const [addingBarrier, setAddingBarrier] = useState(false)
  const [newBarrierText, setNewBarrierText] = useState('')

  // Auth-aware persistence: localStorage for guests, Supabase for signed-in users.
  const { supabaseUser } = useAuth()
  const isSignedIn = Boolean(supabaseUser)

  // Live life-stats from /api/me/life-stats (real backend loader — mentality,
  // happiness, focus, energy computed from reflections + milestones + calendar
  // + check-ins). null until the first fetch resolves; falls back to a
  // profile-derived approximation below for guests.
  type LiveStat = { value: number; change: number | null }
  const [liveStats, setLiveStats] = useState<null | {
    mentality: LiveStat
    happiness: LiveStat
    focus: LiveStat
    energy: LiveStat
  }>(null)

  // On sign-in: replace local state with whatever Supabase has.
  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me/progress', { cache: 'no-store', credentials: 'include' })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        const completed = new Set<string>()
        const hearted = new Set<string>()
        for (const row of json.progress || []) {
          if (row.kind === 'completed') completed.add(row.milestone_id)
          else if (row.kind === 'hearted') hearted.add(row.milestone_id)
        }
        setCompletedMilestoneIds(completed)
        setHeartedGoals(hearted)
      } catch {
        /* keep local state */
      }
    })()
    return () => { cancelled = true }
  }, [isSignedIn])

  // On sign-in: hydrate live life-stats from the real backend loader.
  useEffect(() => {
    if (!isSignedIn) { setLiveStats(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me/life-stats', { cache: 'no-store', credentials: 'include' })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled || !json?.stats) return
        setLiveStats({
          mentality: { value: Number(json.stats.mentality?.value ?? 0), change: json.stats.mentality?.change ?? null },
          happiness: { value: Number(json.stats.happiness?.value ?? 0), change: json.stats.happiness?.change ?? null },
          focus:     { value: Number(json.stats.focus?.value     ?? 0), change: json.stats.focus?.change     ?? null },
          energy:    { value: Number(json.stats.energy?.value    ?? 0), change: json.stats.energy?.change    ?? null },
        })
      } catch {
        /* keep fallback */
      }
    })()
    return () => { cancelled = true }
  }, [isSignedIn])

  // Persist hearted goals + completed milestones to localStorage
  useEffect(() => { try { localStorage.setItem('heartedGoals', JSON.stringify([...heartedGoals])) } catch {} }, [heartedGoals])
  useEffect(() => { try { localStorage.setItem('completedMilestoneIds', JSON.stringify([...completedMilestoneIds])) } catch {} }, [completedMilestoneIds])
  useEffect(() => { try { localStorage.setItem('raceExtraBarriers', JSON.stringify(extraBarriers)) } catch {} }, [extraBarriers])

  const toggleHeart = (id: string) => {
    setHeartedGoals(prev => {
      const next = new Set(prev)
      const wasHearted = next.has(id)
      if (wasHearted) next.delete(id); else next.add(id)
      if (isSignedIn) {
        if (wasHearted) {
          fetch(`/api/me/progress?milestone_id=${encodeURIComponent(id)}&kind=hearted`, { method: 'DELETE', credentials: 'include' }).catch(() => {})
        } else {
          fetch('/api/me/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ milestone_id: id, kind: 'hearted' }),
          }).catch(() => {})
        }
      }
      return next
    })
  }
  const toggleMilestoneComplete = (id: string) => {
    setCompletedMilestoneIds(prev => {
      const next = new Set(prev)
      const wasCompleted = next.has(id)
      if (wasCompleted) next.delete(id); else next.add(id)
      if (isSignedIn) {
        if (wasCompleted) {
          fetch(`/api/me/progress?milestone_id=${encodeURIComponent(id)}&kind=completed`, { method: 'DELETE', credentials: 'include' }).catch(() => {})
        } else {
          fetch('/api/me/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ milestone_id: id, kind: 'completed' }),
          }).catch(() => {})
        }
      }
      return next
    })
  }

  /* ═══ REAL CONNECTIONS for the compare picker (no mock people) ═══ */
  const [realConnections, setRealConnections] = useState<Record<string, any[]>>({ friends: [], mentors: [], rolemodels: [] })
  useEffect(() => {
    let cancelled = false
    fetch('/api/connections', { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!cancelled && j?.connections) setRealConnections(j.connections) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (showRocketEntry) {
      const t1 = setTimeout(() => setRocketPhase('landing'), 1500)
      const t2 = setTimeout(() => setRocketPhase('landed'), 2500)
      const t3 = setTimeout(() => setShowRocketEntry(false), 3500)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    }
  }, [showRocketEntry])

  const theirStats = { mentality: 7, happiness: 9, focus: 8, energy: 6 }
  const theirProgress = 65, yourProgress = 45
  // Stats card: prefer the real life-stats loader (Supabase-backed
  // /api/me/life-stats — mentality, happiness, focus, energy computed from
  // reflections + milestones + calendar + check-ins). For guests / pre-load,
  // fall back to a profile-derived approximation so the demo still has bars.
  const _userBarrierCount = (payload?.userProfile?.barrierTypes || []).length
  const _userGoalCount = (payload?.userProfile?.goals || []).length
  const _userDreamCount = (payload?.userProfile?.dreams || []).length
  const _userChallengeCount = (payload?.userProfile?.currentChallenges || []).length
  const _clamp = (n: number) => Math.max(1, Math.min(10, n))
  const stats: { name: string; value: number; max: number; change: number | null }[] = liveStats
    ? [
        { name: 'Mentality', value: liveStats.mentality.value, max: 10, change: liveStats.mentality.change },
        { name: 'Happiness', value: liveStats.happiness.value, max: 10, change: liveStats.happiness.change },
        { name: 'Focus',     value: liveStats.focus.value,     max: 10, change: liveStats.focus.change },
        { name: 'Energy',    value: liveStats.energy.value,    max: 10, change: liveStats.energy.change },
      ]
    : [
        { name: 'Mentality', value: _clamp(4 + _userBarrierCount), max: 10, change: null },
        { name: 'Happiness', value: _clamp(5 + _userDreamCount), max: 10, change: null },
        { name: 'Focus',     value: _clamp(3 + _userChallengeCount), max: 10, change: null },
        { name: 'Energy',    value: _clamp(4 + _userGoalCount + _userDreamCount), max: 10, change: null },
      ]
  const motivations = ['Focus on progress, not perfection', 'One small step at a time', 'Your differences are your superpowers', 'Rest is part of the journey', 'Celebrate every win', 'You are enough']
  // Recommended choices for the CURRENT milestone come from the
  // tool_recommendation agent. Fall back to the demo list if we have none.
  const _agentMs: any[] = (pathPlanning?.milestones || []) as any[]
  const _currentMsId: string | undefined = _agentMs[0]?.id
  const _currentRecs: any[] = _currentMsId ? ((toolRecommendation?.recommendations || {})[_currentMsId] || []) : []
  // Rating and review count come straight from the agent, which reads them
  // from ServiceHub's `ratings` table. Both are NULL for an unrated resource.
  // They used to default to `t.reviews || 100 + i * 25` — and because the
  // backend never set `reviews`, that produced 100 / 125 / 150 by array index
  // and presented it as social proof.
  const _agentChoices = _currentRecs.slice(0, 4).map((t: any, i: number) => ({
    id: `c${i + 1}`,
    name: t.name || 'Recommended resource',
    rating: typeof t.rating === 'number' ? t.rating : null,
    reviews: typeof t.reviews === 'number' ? t.reviews : 0,
  }))
  const recommendedChoices = _agentChoices.length
    ? [
        ..._agentChoices,
        { id: 'see', name: '(See more)', rating: null as number | null, reviews: 0 },
      ]
    : isSignedIn
    ? []                       // signed in, no recommendations yet — show none
    : [
        // Signed-out demo only.
        { id: 'c1', name: 'Recommended Choice 1', rating: 4.5 as number | null, reviews: 12 },
        { id: 'c2', name: 'Recommended Choice 2', rating: 4.2 as number | null, reviews: 8 },
        { id: 'see', name: '(See more)', rating: null as number | null, reviews: 0 },
      ]
  // Real agent-derived races (fallback to mock if no path data yet)
  const userBarrierLabels: string[] = [
    ...((payload?.userProfile?.barrierTypes || []) as string[]),
    ...extraBarriers,
  ]
  const userGoalNames: string[] = (payload?.userProfile?.goals || []) as string[]
  const agentMilestoneList: any[] = (pathPlanning?.milestones || payload?.milestones || []) as any[]
  const firstMilestoneName: string | undefined = agentMilestoneList[0]?.name || agentMilestoneList[0]?.title
  const rawRaces = payload?.races?.length
    ? payload.races.map((r: any, idx: number) => ({
        id: r.id || `r${idx + 1}`,
        // Prefer the user's actual goal text over the backend's generic\n        // "Main Goal" label.
        name: userGoalNames[idx] || r.name || r.goal || `Goal ${idx + 1}`,
        progress: typeof r.progress === 'number' ? r.progress : 0,
        milestone: r.milestone || r.currentMilestone || firstMilestoneName || 'Getting started',
        models: userBarrierLabels.length ? userBarrierLabels : (r.models || []),
      }))
    : (payload?.userProfile?.goals as string[] | undefined)?.map((goal: string, idx: number) => ({
        id: `r${idx + 1}`,
        name: goal,
        progress: 0,
        milestone: firstMilestoneName || 'Getting started',
        models: userBarrierLabels,
      })) || []
  // The UI hard-references races[0] and races[1]. Pad with a placeholder when
  // the user only declared a single goal so we never crash.
  const races = rawRaces.length >= 2
    ? rawRaces
    : [
        ...rawRaces,
        { id: 'r_placeholder', name: 'Add another goal', progress: 0, milestone: 'Open onboarding to add', models: userBarrierLabels },
      ]
  // Pit-stop shop items from the tool_recommendation agent. Each bucket
  // (products/services/commentaries/other) gets a distinct emoji.
  const _pit: any = toolRecommendation?.pit_stop_tools || {}
  const _emojiByBucket: Record<string, string> = { products: '👢', services: '🔑', commentaries: '🏋️', other: '🔨' }
  const _agentShop: { emoji: string; name: string; cost: string }[] = []
  ;(['products', 'services', 'commentaries', 'other'] as const).forEach((bucket) => {
    ((_pit[bucket] || []) as any[]).slice(0, 3).forEach((t: any, idx: number) => {
      _agentShop.push({
        emoji: _emojiByBucket[bucket],
        name: t.name || `${bucket.slice(0, -1)} ${idx + 1}`,
        cost: `${5 + idx * 3} coins`,
      })
    })
  })
  const shopItems = _agentShop.length
    ? _agentShop
    : isSignedIn
    ? []                       // signed in, agents produced no shop items yet
    : [
        { emoji: '🍎', name: 'Energy Apple', cost: '5 coins' },
        { emoji: '☕', name: 'Focus Brew', cost: '8 coins' },
        { emoji: '🧃', name: 'Calm Juice', cost: '6 coins' },
        { emoji: '🔧', name: 'Planner Tool', cost: '12 coins' },
        { emoji: '📚', name: 'Study Guide', cost: '15 coins' },
        { emoji: '🎧', name: 'Headphones', cost: '20 coins' },
        { emoji: '⚡', name: 'Speed Boost', cost: '25 coins' },
        { emoji: '🛡️', name: 'Barrier Shield', cost: '30 coins' },
        { emoji: '✨', name: 'Motivation Spark', cost: '18 coins' },
      ]
  // Real agent-derived milestones (fallback to mock if no path data yet).
  // We intentionally render ALL milestones so every dimension's roadmap
  // (Education, Workplace, Relationships, Health) is visible on the track.
  const _dimLabel = (d?: string): string => {
    switch ((d || '').toLowerCase()) {
      case 'education':     return 'Education'
      case 'workplace':
      case 'career':        return 'Workplace'
      case 'relationships': return 'Relationships'
      case 'health':        return 'Health & Lifestyle'
      default:              return ''
    }
  }
  const milestones = agentMilestoneList.length
    ? agentMilestoneList.map((m: any, idx: number) => ({
        id: m.id || `m${idx}`,
        name: m.name || m.title || `Milestone ${idx + 1}`,
        dist: idx === 0 ? 'Current' : `${idx} of ${agentMilestoneList.length}`,
        status: (idx === 0 ? 'active' : idx < Math.ceil(agentMilestoneList.length / 2) ? 'upcoming' : 'far') as 'active' | 'upcoming' | 'far',
        dimension: m.dimension || m.category || '',
        dimensionLabel: m.dimensionLabel || _dimLabel(m.dimension || m.category),
        goal: m.goal || '',
        raceId: m.raceId || '',
      }))
    : isSignedIn
    // Signed in with no generated path: show NOTHING rather than a borrowed
    // plan. The mock below is a signed-out demo only — it used to render for
    // real accounts too, which is how testers ended up reviewing invented
    // milestones and reporting on them as if they were their own.
    ? []
    : [
        { id: 'm0', name: 'Request Accommodations', dist: 'Current', status: 'active' as const, dimension: '', dimensionLabel: '', goal: '' },
        { id: 'm1', name: 'Complete Semester 1', dist: '2 steps', status: 'upcoming' as const, dimension: '', dimensionLabel: '', goal: '' },
        { id: 'm2', name: 'Join Study Group', dist: '4 steps', status: 'upcoming' as const, dimension: '', dimensionLabel: '', goal: '' },
        { id: 'm3', name: 'Graduate!', dist: '10 steps', status: 'far' as const, dimension: '', dimensionLabel: '', goal: '' },
      ]

  // ── Real progress ─────────────────────────────────────────────────
  // Override each race's progress with the % of its milestones the user has
  // actually completed (from race_progress). When a race has no attributable
  // milestones we keep whatever the payload provided (mock for guests).
  races.forEach((r: any) => {
    const p = computeRaceProgress(r, milestones, completedMilestoneIds)
    if (p !== null) r.progress = p
  })

  // Steps the user has ACTUALLY ticked off. This used to be three fixed
  // literals ("Completed: Research accommodations", …) with no guard at all, so
  // every account — brand new ones included — was shown the same invented
  // history. Signed-out visitors get a short sample so the page still reads as
  // a demo; signed-in users only ever see their own completions.
  const previousSteps = isSignedIn
    ? milestones
        .filter((m: any) => completedMilestoneIds.has(m.id))
        .map((m: any) => ({ id: m.id, name: `Completed: ${m.name}` }))
    : [
        { id: 'demo-s1', name: 'Completed: Research accommodations' },
        { id: 'demo-s2', name: 'Completed: Initial assessment' },
        { id: 'demo-s3', name: 'Completed: Set up profile' },
      ]

  // ── Real goal wiring ──────────────────────────────────────────────
  // Each agent milestone carries { dimension, goal }. A single goal is
  // supported across all four life dimensions, so the "Goal" shown under
  // a dimension = the distinct real goal(s) whose milestones live in that
  // dimension. Fall back to the user's onboarding goals, then to a
  // per-dimension placeholder.
  const _normDim = (d: string) => { const k = (d || '').toLowerCase(); return k === 'career' ? 'workplace' : k }
  const goalForDim = (dimKey: string, fallback: string): string => {
    const fromMs = Array.from(new Set(
      milestones.filter((m: any) => _normDim(m.dimension) === dimKey).map((m: any) => m.goal).filter(Boolean)
    )) as string[]
    const list = fromMs.length ? fromMs : userGoalNames
    return list.filter(Boolean).join(' · ') || fallback
  }
  // Shared dimension metadata — single source of truth for the checklist
  // tabs and the "Separate" parallel-tracks view.
  const dimMeta = [
    { key: 'education',     label: 'Education',          emoji: '🎓', goal: 'Graduate & build a strong foundation', tint: 'from-sky-50 to-white border-sky-200',         tintDark: 'from-sky-900/40 to-indigo-950/60 border-sky-800' },
    { key: 'workplace',     label: 'Workplace',          emoji: '💼', goal: 'Land a fulfilling, flexible job',      tint: 'from-amber-50 to-white border-amber-200',     tintDark: 'from-amber-900/40 to-indigo-950/60 border-amber-800' },
    { key: 'relationships', label: 'Relationships',      emoji: '🤝', goal: 'Build a supportive circle',            tint: 'from-pink-50 to-white border-pink-200',       tintDark: 'from-pink-900/40 to-indigo-950/60 border-pink-800' },
    { key: 'health',        label: 'Health & Lifestyle', emoji: '🌱', goal: 'Feel balanced & energized',           tint: 'from-emerald-50 to-white border-emerald-200', tintDark: 'from-emerald-900/40 to-indigo-950/60 border-emerald-800' },
    { key: 'barrier',       label: 'Barrier-Specific',   emoji: '🛡️', goal: 'Navigate barriers with support',       tint: 'from-violet-50 to-white border-violet-200',   tintDark: 'from-violet-900/40 to-indigo-950/60 border-violet-800' },
  ]

  // Real agent-derived schedule (fallback to mock if no path data yet)
  const schedule = payload?.schedule?.length
    ? payload.schedule.slice(0, 6).map((s: any) => ({
        time: s.time || s.start || '',
        task: s.task || s.title || s.name || 'Task',
        emoji: s.emoji || '⏰',
      }))
    : [
        { time: '9 AM', task: 'Morning Focus', emoji: '📖' },
        { time: '11 AM', task: 'Accommodation Meeting', emoji: '🎯' },
        { time: '1 PM', task: 'Lunch & Recharge', emoji: '☕' },
        { time: '3 PM', task: 'Group Study', emoji: '👥' },
        { time: '5 PM', task: 'Reflection', emoji: '📝' },
      ]
  const spinWheel = () => {
    if (isWheelSpinning) return
    setIsWheelSpinning(true)
    setWheelRotation(prev => prev + 1080 + Math.random() * 720)
    setTimeout(() => {
      const m = motivations[Math.floor(Math.random() * motivations.length)]
      setTodaysMotivation(m)
      try {
        localStorage.setItem('todaysMotivation', m)
        localStorage.setItem('todaysMotivationDate', new Date().toDateString())
      } catch {}
      setIsWheelSpinning(false)
    }, 2000)
  }

  // Motivation is picked ONCE at the start of each day and stays put (Eliyana:
  // the wheel generating a fresh quote every visit got repetitive). Spinning is
  // still available to change it on purpose.
  useEffect(() => {
    try {
      const today = new Date().toDateString()
      const savedDate = localStorage.getItem('todaysMotivationDate')
      const saved = localStorage.getItem('todaysMotivation')
      if (savedDate === today && saved) {
        setTodaysMotivation(saved)
      } else {
        const m = motivations[Math.floor(Math.random() * motivations.length)]
        setTodaysMotivation(m)
        localStorage.setItem('todaysMotivation', m)
        localStorage.setItem('todaysMotivationDate', today)
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const day = isDayTheme
  const roadCol = day ? 'bg-slate-200/70' : 'bg-indigo-900/50'
  const roadBorder = day ? 'border-slate-300' : 'border-indigo-700'
  const trackCol = day ? 'bg-slate-300/60' : 'bg-indigo-800/40'
  const laneMarkCol = day ? 'bg-white' : 'bg-indigo-400'
  const txt = day ? 'text-slate-800' : 'text-white'
  const sub = day ? 'text-slate-500' : 'text-indigo-300'
  const pill = day ? 'bg-white/80 border-slate-200' : 'bg-indigo-950/70 border-indigo-700'
  const accent = day ? 'from-sky-400 to-indigo-500' : 'from-purple-500 to-pink-500'
  const line = day ? '#38bdf8' : '#818cf8'
  const stroke = day ? '#0369a1' : '#a78bfa'

  // View gating: List shows the streamlined top + checklist. Track can be a
  // single continuous road ("one") or parallel dimension tracks ("separate").
  const showTrail = layoutMode === 'track' && trackShape === 'trail'
  const showContinuousTrack = layoutMode === 'track' && trackShape === 'one'
  const showSeparateTrack = layoutMode === 'track' && trackShape === 'separate'
  // Odosa: Checklist View lives in List View ONLY. Track View gets the race
  // track instead, so the two modes actually differ below the shared top.
  const showChecklist = layoutMode === 'list'

  // ── Race-track stops (Odosa) ────────────────────────────────────────
  // Five dots on the path. The "active" milestone is the one that carries
  // "You are here", and it also decides which grid row the Pit Stop and
  // Current Goals panels sit in, so they flank the path beside it.
  const trackStops = milestones.slice(0, 5)
  const _activeStop = trackStops.findIndex((m: any) => m.status === 'active')
  const currentStopIdx = _activeStop >= 0 ? _activeStop : 0

  const css = `
    @keyframes rocketFly{0%{transform:translateY(100vh) rotate(-15deg) scale(.5);opacity:0}30%{opacity:1;transform:translateY(30vh) rotate(-5deg) scale(1)}60%{transform:translateY(-10vh) rotate(5deg) scale(1.1)}100%{transform:translateY(-120vh) rotate(0) scale(.3);opacity:0}}
    @keyframes rocketLand{0%{transform:translateY(-50vh) scale(.5);opacity:0}50%{opacity:1;transform:translateY(10px) scale(1.1)}80%{transform:translateY(-5px) scale(1)}100%{transform:translateY(0) scale(1);opacity:1}}
    @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes dreamGlow{0%,100%{filter:drop-shadow(0 0 12px rgba(139,92,246,.3))}50%{filter:drop-shadow(0 0 28px rgba(139,92,246,.6))}}
    @keyframes cloudFloat{0%,100%{transform:translateX(0) translateY(0)}25%{transform:translateX(10px) translateY(-5px)}75%{transform:translateX(-8px) translateY(-3px)}}
    @keyframes starTwinkle{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.4)}}
    @keyframes signSwing{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
    @keyframes dashMove{to{stroke-dashoffset:-20}}
    @keyframes awningWave{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.03)}}
    .bn{animation:bounce 2s ease-in-out infinite}
    .dg{animation:dreamGlow 3s ease-in-out infinite}
    .cf{animation:cloudFloat 8s ease-in-out infinite}
    .st{animation:starTwinkle 2s ease-in-out infinite}
    .sw{animation:signSwing 3s ease-in-out infinite}
    .aw{animation:awningWave 4s ease-in-out infinite}
  `

  /* Storefront navigation row — Toolbox · ResourceHub · Hare World · Tidbits */
  const StorefrontRow = () => {
    const hub = goHubHref('/')
    const shops: { emoji: string; name: string; desc: string; href: string; ext: boolean }[] = [
      { emoji: '🧰', name: 'Toolbox',     desc: 'Quick tools & utilities',   href: '/tools',                                ext: false },
      { emoji: '🏪', name: 'ResourceHub', desc: 'Curated services & support', href: hub,                                     ext: true  },
      { emoji: '🐰', name: 'Hare World',  desc: 'Role models & mentors',      href: '/pit-stop?tab=haveworld&view=people',   ext: false },
      { emoji: '💬', name: 'Tidbits',     desc: 'Community Q&A',              href: `${hub}/community?from=hare-world&context=races`, ext: true  },
    ]
    return (
      <div className="w-full max-w-3xl px-2 my-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {shops.map(s => {
            const inner = (
              <>
                <div className="text-2xl mb-1">{s.emoji}</div>
                <div className={`font-bold text-xs ${txt}`}>{s.name}</div>
                <div className={`text-[9px] ${sub} mb-2 leading-snug`}>{s.desc}</div>
                <div className={`text-[10px] font-bold px-2 py-1 rounded-lg shadow bg-gradient-to-r ${accent} text-white`}>Go to {s.name} →</div>
              </>
            )
            const cls = `${pill} border rounded-xl p-3 shadow-sm text-center flex flex-col items-center transition-all hover:scale-[1.03]`
            return s.ext ? (
              <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
            ) : (
              <Link key={s.name} href={s.href} className={cls}>{inner}</Link>
            )
          })}
        </div>
      </div>
    )
  }

  /* Race-track road segment with lane markings */
  const RoadDown = ({ h = 60 }: { h?: number }) => (
    <div className="flex justify-center" style={{ margin: '-1px 0' }}>
      <div className={`relative ${trackCol} rounded-sm`} style={{ width: 52, height: h }}>
        {/* Outer edge lines */}
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${day ? 'bg-amber-400' : 'bg-amber-600'} rounded-full`} />
        <div className={`absolute right-0 top-0 bottom-0 w-[3px] ${day ? 'bg-amber-400' : 'bg-amber-600'} rounded-full`} />
        {/* Center dashed lane marking */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 flex flex-col items-center justify-around">
          {Array.from({ length: Math.max(2, Math.floor(h / 16)) }, (_, i) => (
            <div key={i} className={`w-[3px] h-[8px] ${laneMarkCol} rounded-full opacity-60`} />
          ))}
        </div>
      </div>
    </div>
  )

  /* Fan-out: one point at top splits into N paths at bottom — race track style */
  const FanOut = ({ count = 5 }: { count?: number }) => {
    const w = 400, h = 120
    const cx = w / 2
    const spacing = w / (count + 1)
    return (
      <div className="flex justify-center" style={{ margin: '-2px 0' }}>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '500px' }} preserveAspectRatio="xMidYMid meet">
          {Array.from({ length: count }, (_, i) => {
            const ex = spacing * (i + 1)
            const sw = i === Math.floor(count / 2) ? 20 : 14
            const op = i === Math.floor(count / 2) ? 0.6 : 0.4
            return (
              <g key={i}>
                {/* Track surface */}
                <path d={`M${cx},0 Q${cx},${h * 0.5} ${ex},${h}`} stroke={day ? '#cbd5e1' : '#1e1b4b'} strokeWidth={sw} fill="none" strokeLinecap="round" opacity={op} />
                {/* Edge lines (amber) */}
                <path d={`M${cx},0 Q${cx},${h * 0.5} ${ex},${h}`} stroke={day ? '#fbbf24' : '#b45309'} strokeWidth={sw + 2} fill="none" strokeLinecap="round" opacity={op * 0.4} />
                <path d={`M${cx},0 Q${cx},${h * 0.5} ${ex},${h}`} stroke={day ? '#cbd5e1' : '#1e1b4b'} strokeWidth={sw - 2} fill="none" strokeLinecap="round" opacity={op + 0.1} />
                {/* Center lane dash */}
                <path d={`M${cx},0 Q${cx},${h * 0.5} ${ex},${h}`} stroke={day ? 'white' : '#818cf8'} strokeWidth="2" fill="none" strokeDasharray="6 8" opacity=".5" />
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  /* Fan-in: N points at top converge to one at bottom — race track style */
  const FanIn = ({ count = 5 }: { count?: number }) => {
    const w = 400, h = 140
    const cx = w / 2
    const spacing = w / (count + 1)
    return (
      <div className="flex justify-center" style={{ margin: '-2px 0' }}>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '500px' }} preserveAspectRatio="xMidYMid meet">
          {Array.from({ length: count }, (_, i) => {
            const sx = spacing * (i + 1)
            const sw = i === Math.floor(count / 2) ? 20 : 14
            const op = i === Math.floor(count / 2) ? 0.6 : 0.4
            return (
              <g key={i}>
                <path d={`M${sx},0 Q${sx},${h * 0.5} ${cx},${h}`} stroke={day ? '#fbbf24' : '#b45309'} strokeWidth={sw + 2} fill="none" strokeLinecap="round" opacity={op * 0.4} />
                <path d={`M${sx},0 Q${sx},${h * 0.5} ${cx},${h}`} stroke={day ? '#cbd5e1' : '#1e1b4b'} strokeWidth={sw} fill="none" strokeLinecap="round" opacity={op} />
                <path d={`M${sx},0 Q${sx},${h * 0.5} ${cx},${h}`} stroke={day ? 'white' : '#818cf8'} strokeWidth="2" fill="none" strokeDasharray="6 8" opacity=".5" />
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  /* Fork: one road splits into two — race track style */
  const Fork = () => {
    const w = 300, h = 80
    return (
      <div className="flex justify-center" style={{ margin: '-2px 0' }}>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '360px' }} preserveAspectRatio="xMidYMid meet">
          {/* Edge lines */}
          <path d={`M${w / 2},0 Q${w / 2},${h * 0.5} ${w * 0.3},${h}`} stroke={day ? '#fbbf24' : '#b45309'} strokeWidth="26" fill="none" strokeLinecap="round" opacity=".2" />
          <path d={`M${w / 2},0 Q${w / 2},${h * 0.5} ${w * 0.7},${h}`} stroke={day ? '#fbbf24' : '#b45309'} strokeWidth="26" fill="none" strokeLinecap="round" opacity=".2" />
          {/* Track surface */}
          <path d={`M${w / 2},0 Q${w / 2},${h * 0.5} ${w * 0.3},${h}`} stroke={day ? '#cbd5e1' : '#1e1b4b'} strokeWidth="22" fill="none" strokeLinecap="round" opacity=".5" />
          <path d={`M${w / 2},0 Q${w / 2},${h * 0.5} ${w * 0.7},${h}`} stroke={day ? '#cbd5e1' : '#1e1b4b'} strokeWidth="22" fill="none" strokeLinecap="round" opacity=".5" />
          {/* Lane dashes */}
          <path d={`M${w / 2},0 Q${w / 2},${h * 0.5} ${w * 0.3},${h}`} stroke={day ? 'white' : '#818cf8'} strokeWidth="2" fill="none" strokeDasharray="6 8" opacity=".5" />
          <path d={`M${w / 2},0 Q${w / 2},${h * 0.5} ${w * 0.7},${h}`} stroke={day ? 'white' : '#818cf8'} strokeWidth="2" fill="none" strokeDasharray="6 8" opacity=".5" />
        </svg>
      </div>
    )
  }

  /* Two parallel race track corridors */
  const TwoCorridors = ({ h = 200 }: { h?: number }) => {
    return (
      <div className="flex justify-center gap-16" style={{ margin: '-2px 0' }}>
        {/* Left corridor */}
        <div className={`relative w-16 ${trackCol} rounded-t-3xl rounded-b-lg`} style={{ height: h }}>
          {/* Edge lines */}
          <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${day ? 'bg-amber-400' : 'bg-amber-600'} rounded-full`} />
          <div className={`absolute right-0 top-0 bottom-0 w-[3px] ${day ? 'bg-amber-400' : 'bg-amber-600'} rounded-full`} />
          {/* Lane dashes */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 bottom-2 flex flex-col items-center justify-around">
            {Array.from({ length: Math.floor(h / 18) }, (_, i) => (
              <div key={i} className={`w-[3px] h-[8px] ${laneMarkCol} rounded-full opacity-50`} />
            ))}
          </div>
        </div>
        {/* Right corridor */}
        <div className={`relative w-16 ${trackCol} rounded-t-3xl rounded-b-lg`} style={{ height: h }}>
          <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${day ? 'bg-amber-400' : 'bg-amber-600'} rounded-full`} />
          <div className={`absolute right-0 top-0 bottom-0 w-[3px] ${day ? 'bg-amber-400' : 'bg-amber-600'} rounded-full`} />
          <div className="absolute left-1/2 -translate-x-1/2 top-2 bottom-2 flex flex-col items-center justify-around">
            {Array.from({ length: Math.floor(h / 18) }, (_, i) => (
              <div key={i} className={`w-[3px] h-[8px] ${laneMarkCol} rounded-full opacity-50`} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // No demo data: honest loading / empty states instead of fake races.
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        <p className="text-sm text-slate-500">Loading your races…</p>
      </div>
    )
  }
  if (rawRaces.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-5xl">🏁</div>
        <h1 className="text-xl font-bold text-slate-800">No races yet</h1>
        <p className="text-sm text-slate-500 max-w-sm">
          Your goals become races once your path is generated. Complete onboarding to build one.
        </p>
        <Link href="/onboarding" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:shadow-lg transition-all">
          Go to onboarding →
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* ═══ ROCKET ENTRY ═══ */}
      {showRocketEntry && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-purple-900 to-sky-400">
          <style>{css}</style>
          {Array.from({ length: 25 }, (_, i) => (
            <div key={i} className="absolute w-1 h-1 bg-white rounded-full" style={{ left: `${(i * 37 + 13) % 100}%`, top: `${(i * 23 + 7) % 60}%`, opacity: ((i * 17) % 80 + 20) / 100, animation: `starTwinkle ${1 + i % 3}s ease-in-out infinite`, animationDelay: `${(i * 13 % 200) / 100}s` }} />
          ))}
          <div className="text-8xl z-10" style={{ animation: rocketPhase === 'flying' ? 'rocketFly 3s ease-in-out forwards' : rocketPhase === 'landing' ? 'rocketLand 1s ease-out forwards' : 'none', transform: rocketPhase === 'landed' ? 'translateY(0) scale(1)' : undefined }}>🚀</div>
          <div className={`text-center mt-8 z-10 transition-opacity duration-500 ${rocketPhase === 'flying' ? 'opacity-0' : 'opacity-100'}`}>
            <h1 className="text-4xl font-bold text-white mb-2">{rocketPhase === 'landing' ? 'Landing in Dream Land...' : '☁️ Welcome to Dream Land!'}</h1>
            <p className="text-sky-200 text-lg">Where your dreams take shape</p>
          </div>
        </div>
      )}

      {/* ═══ PAGE ═══ */}
      <div className={`min-h-screen ${day ? 'bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50' : 'bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950'} relative overflow-x-hidden transition-colors duration-700`}>
        <style>{css}</style>

        {/* Atmospheric background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          {[{ w: 200, h: 80, l: '5%', tp: '5%' }, { w: 180, h: 70, l: '30%', tp: '2%' }, { w: 160, h: 65, l: '62%', tp: '8%' }, { w: 220, h: 90, l: '82%', tp: '3%' }, { w: 140, h: 60, l: '15%', tp: '50%' }, { w: 170, h: 75, l: '75%', tp: '60%' }].map((c, i) => (
            <div key={i} className={`absolute rounded-full blur-xl cf ${day ? 'bg-white/40' : 'bg-indigo-300/8'}`} style={{ width: c.w, height: c.h, left: c.l, top: c.tp, animationDelay: `${i * 1.5}s` }} />
          ))}
          {!day && Array.from({ length: 25 }, (_, i) => (
            <div key={`s${i}`} className="absolute w-1 h-1 bg-white rounded-full st" style={{ left: `${(i * 41 + 7) % 100}%`, top: `${(i * 31 + 13) % 100}%`, animationDelay: `${(i * 17 % 300) / 100}s` }} />
          ))}
        </div>

        {/* ═══ STICKY HEADER ═══ */}
        <header className={`sticky top-0 z-40 ${day ? 'bg-sky-100/90' : 'bg-indigo-950/90'} backdrop-blur-md border-b ${day ? 'border-sky-200' : 'border-indigo-800'} px-4 py-2`}>
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
              <button onClick={() => {
                // If an overlay view (compare / newview) is open, close it first
                // so Back doesn't just undo query-param changes. Otherwise go
                // back a screen to the Path (Odosa: "back button undoes actions
                // rather than going back a screen").
                if (comparisonView || newView) {
                  router.push('/races')
                } else {
                  router.push('/path')
                }
              }} className={`p-1 rounded-lg hover:opacity-70 ${txt}`}><ArrowLeft className="w-5 h-5" /></button>
              <h1 className={`text-lg font-bold ${txt}`}>🏁 Dream Land Race Track</h1>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Motivation Pinwheel - position follows the user's saved layout preference */}
              <div className="relative pref-widget" style={{ order: prefs.layout.pinwheelSide === 'right' ? 99 : -1 }}>
                <button
                  onClick={() => setShowPinwheelPopup(true)}
                  onMouseEnter={() => setPinwheelHover(true)}
                  onMouseLeave={() => setPinwheelHover(false)}
                  className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all"
                >
                  <svg viewBox="0 0 50 50" className="w-6 h-6">
                    {[0, 60, 120, 180, 240, 300].map((a, i) => { const c = ['#38bdf8', '#818cf8', '#f59e0b', '#34d399', '#f472b6', '#60a5fa']; const sa = (a - 90) * Math.PI / 180, ea = (a + 60 - 90) * Math.PI / 180; return <path key={i} d={`M25 25 L${25 + 20 * Math.cos(sa)} ${25 + 20 * Math.sin(sa)} A20 20 0 0 1 ${25 + 20 * Math.cos(ea)} ${25 + 20 * Math.sin(ea)}Z`} fill={c[i]} stroke="white" strokeWidth="1" /> })}
                    <circle cx="25" cy="25" r="5" fill="white" />
                  </svg>
                </button>
                {pinwheelHover && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
                    Motivation Pinwheel
                  </div>
                )}
              </div>
              <button onClick={() => setIsDayTheme(!isDayTheme)} className={`px-2 py-1 rounded-lg text-xs font-semibold shadow ${day ? 'bg-indigo-600 text-white' : 'bg-amber-400 text-slate-900'}`}>{day ? '🌙' : '☀️'}</button>
              <div className="relative">
                <button onClick={() => { setShowCompareMenu(!showCompareMenu); setShowNewViewsMenu(false) }} className={`px-2 py-1 bg-gradient-to-r ${accent} text-white rounded-lg text-xs font-semibold`}><RefreshCw className="w-3 h-3 inline mr-1" />Compare</button>
                {showCompareMenu && <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border z-50 min-w-[190px] p-1.5">{[{ k: 'rolemodel', l: 'To Role Model(s)', I: Users }, { k: 'friend', l: 'To Friend-vals', I: UserPlus }, { k: 'mentor', l: 'To Mentoring', I: UserCheck }, { k: 'recommendations', l: 'To Recommendations', I: Sparkles }].map(x => (<button key={x.k} onClick={() => { router.push(`/races?compare=${x.k}`); setShowCompareMenu(false) }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded text-sm text-slate-700"><x.I className="w-4 h-4" />{x.l}</button>))}</div>}
              </div>
              <div className="relative">
                <button onClick={() => { setShowNewViewsMenu(!showNewViewsMenu); setShowCompareMenu(false) }} className="px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-xs font-semibold"><Filter className="w-3 h-3 inline mr-1" />Views</button>
                {showNewViewsMenu && <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border z-50 min-w-[160px] p-1.5">{[{ k: 'avoidance', l: '① Avoidance' }, { k: 'suggestions', l: '② Suggestions' }, { k: 'compete', l: '③ Compete' }].map(v => (<button key={v.k} onClick={() => { router.push(`/races?newview=${v.k}`); setShowNewViewsMenu(false) }} className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm text-slate-700">{v.l}</button>))}</div>}
              </div>
            </div>
          </div>
        </header>

        {/* ═══ COMPARISON — real connections only. Picking a person opens their
            real shared view (/friend/[id]); no fabricated races or stats. ═══ */}
        {comparisonView && (comparisonView === 'rolemodel' || comparisonView === 'friend' || comparisonView === 'mentor') && (() => {
          const catMap: Record<string, { key: string; label: string }> = {
            rolemodel: { key: 'rolemodels', label: 'Role Model' },
            mentor: { key: 'mentors', label: 'Mentor' },
            friend: { key: 'friends', label: 'Friend' },
          }
          const cat = catMap[comparisonView]
          const people = realConnections[cat.key] || []
          const linked = people.filter((p: any) => p.target_user_id)
          const unlinked = people.filter((p: any) => !p.target_user_id)
          return (
            <div className="relative z-30 max-w-3xl mx-auto px-3 pt-3 pb-6">
              <div className={`${day ? 'bg-white/90 border-slate-200' : 'bg-indigo-950/90 border-indigo-800'} border-2 rounded-2xl p-5 shadow-xl`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Eye className={`w-4 h-4 ${sub}`} />
                    <span className={`text-sm font-bold ${txt}`}>Compare with a {cat.label}</span>
                  </div>
                  <button onClick={() => router.push('/races')} className={`p-1.5 rounded-lg hover:opacity-60 ${day ? 'bg-slate-100' : 'bg-indigo-900'} ${txt}`}><X className="w-5 h-5" /></button>
                </div>

                {people.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">👥</div>
                    <p className={`text-sm mb-4 ${sub}`}>You haven&apos;t connected with a {cat.label.toLowerCase()} yet. Comparisons use your real connections&apos; shared paths.</p>
                    <Link href="/pit-stop?tab=haveworld&view=people" className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:shadow-lg transition-all">
                      Find a {cat.label.toLowerCase()} in Hare World →
                    </Link>
                  </div>
                )}

                {linked.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {linked.map((p: any) => (
                      <Link key={p.id} href={`/friend/${p.target_user_id}`} className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 transition-all hover:shadow-md ${day ? 'bg-slate-50 border-slate-200 hover:border-purple-300' : 'bg-indigo-900/40 border-indigo-800 hover:border-purple-500'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{p.icon && p.icon !== '👤' ? p.icon : '🧑'}</span>
                          <div>
                            <div className={`text-sm font-bold ${txt}`}>{p.name}</div>
                            {p.role && <div className={`text-xs ${sub}`}>{p.role}</div>}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-purple-500">View their journey →</span>
                      </Link>
                    ))}
                  </div>
                )}

                {unlinked.length > 0 && (
                  <p className={`text-xs ${sub}`}>
                    {unlinked.map((p: any) => p.name).join(', ')} {unlinked.length === 1 ? 'is' : 'are'} saved as {unlinked.length === 1 ? 'a contact' : 'contacts'} without a linked account — comparisons need a connected app user.
                  </p>
                )}
              </div>
            </div>
          )
        })()}

        {/* ═══ OVERLAY PANELS (non-compare views) ═══ */}
        {newView && (
          <div className="relative z-30 max-w-3xl mx-auto px-4 pt-3">
            <div className={`${day ? 'bg-white/90 border-slate-200' : 'bg-indigo-950/80 border-indigo-700'} border backdrop-blur-sm rounded-2xl p-4 shadow-lg`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className={`text-base font-bold ${txt}`}>{newView === 'avoidance' ? 'Avoidance' : newView === 'suggestions' ? 'Suggestions' : 'Compete'}</h2>
                <button onClick={() => router.push('/races')} className={`${sub} hover:opacity-60`}><X className="w-5 h-5" /></button>
              </div>
              {newView === 'avoidance' && (
                <div className="space-y-1.5">
                  <p className={`text-[11px] ${sub} mb-1`}>Habits and traps to steer clear of — based on your obstacles and common pitfalls.</p>
                  {(() => {
                    const obstacles = (payload?.userProfile?.currentChallenges || []) as string[]
                    const fromObstacles = obstacles.map((o) => ({ t: `Avoid: ${o}`, r: 'You flagged this as an obstacle' }))
                    const generic = [
                      { t: 'All-night study', r: 'Triggers burnout' },
                      { t: 'Cramming', r: 'Increases anxiety' },
                      { t: 'Skipping meals', r: 'Affects focus' },
                      { t: 'Overcommitting', r: 'Overwhelm' },
                    ]
                    return [...fromObstacles, ...generic]
                  })().map((x, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2 ${day ? 'bg-red-50 border-red-200' : 'bg-red-900/30 border-red-800'} border rounded-lg`}>
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className={`font-medium text-xs ${day ? 'text-red-900' : 'text-red-300'}`}>{x.t}</div>
                        <div className={`text-[10px] ${day ? 'text-red-700' : 'text-red-400'}`}>{x.r}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {newView === 'suggestions' && <div className="space-y-2"><div className="flex gap-1">{['All', 'Role Models', 'Mentors', 'Friends'].map(f => <button key={f} onClick={() => setSuggestionFilter(f)} className={`px-2 py-0.5 text-[10px] border rounded-lg ${suggestionFilter === f ? 'bg-purple-500 text-white border-purple-500' : `${pill} ${sub}`}`}>{f}</button>)}</div>{[{ from: 'Sarah (RM)', sug: 'Pomodoro', time: '2h', cat: 'Role Models' }, { from: 'James (M)', sug: 'Smaller steps', time: '5h', cat: 'Mentors' }, { from: 'Alex (F)', sug: 'Body double', time: '1d', cat: 'Friends' }].filter(x => suggestionFilter === 'All' || x.cat === suggestionFilter).map((x, i) => <button key={i} onClick={() => router.push(`/calendar?suggestion=${encodeURIComponent(x.sug)}`)} className={`w-full text-left p-2 ${day ? 'bg-purple-50 border-purple-200' : 'bg-purple-900/30 border-purple-700'} border rounded-lg`}><div className="flex justify-between"><span className={`font-medium text-[10px] ${day ? 'text-purple-900' : 'text-purple-300'}`}>{x.from}</span><span className={`text-[9px] ${sub}`}>{x.time}</span></div><div className={`text-[10px] ${sub}`}>{x.sug}</div></button>)}</div>}
              {newView === 'compete' && <div className="space-y-2">{[{ rival: 'Marcus', g: '10 tasks/wk', y: 6, th: 8 }, { rival: 'Alex', g: '20 hrs', y: 12, th: 15 }].map((c, i) => <div key={i} className={`p-2 border-2 rounded-lg ${day ? 'bg-amber-50 border-amber-200' : 'bg-amber-900/30 border-amber-700'}`}><div className="flex items-center gap-2 mb-1"><div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-[9px]">{c.rival[0]}</div><div className={`text-xs font-medium ${txt}`}>{c.rival} ({c.g})</div></div><div className={`h-1.5 ${day ? 'bg-slate-200' : 'bg-indigo-800'} rounded-full overflow-hidden`}><div className="h-full bg-gradient-to-r from-sky-400 to-amber-400 rounded-full" style={{ width: `${(c.y / Math.max(c.y, c.th)) * 100}%` }} /></div><div className="flex justify-between text-[9px] mt-0.5"><span className={sub}>You:{c.y}</span><span className={sub}>Them:{c.th}</span></div></div>)}</div>}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════
            THE CONTINUOUS ROADMAP
            Every piece is in normal document flow.
            Road connectors (SVGs) sit between content blocks
            so the path is always visually connected.
           ═════════════════════════════════════════════════════════ */}
        <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto px-4">

          {/* ═══ YOUR GOALS, DREAMS & OBSTACLES (from onboarding) ═══
              Surfaced at the very top so users can see their choices ARE
              being considered in what was generated (Odosa's feedback). */}
          {(() => {
            const goalsList: string[] = (payload?.userProfile?.goals || []) as string[]
            const dreamsList: string[] = (payload?.userProfile?.dreams || []) as string[]
            const obstaclesList: string[] = (payload?.userProfile?.currentChallenges || []) as string[]
            if (goalsList.length === 0 && dreamsList.length === 0 && obstaclesList.length === 0) return null
            return (
              <div className={`w-full max-w-2xl px-2 pt-4`}>
                <div className={`${pill} border rounded-2xl p-4 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className={`w-4 h-4 ${day ? 'text-purple-500' : 'text-purple-300'}`} />
                    <h3 className={`font-bold text-sm ${txt}`}>Your Goals, Dreams &amp; Obstacles</h3>
                    <span className={`text-[10px] ${sub} ml-auto`}>Used to generate your races</span>
                  </div>

                  {goalsList.length > 0 && (
                    <div className="mb-2.5">
                      <div className={`text-[10px] font-bold uppercase tracking-wide ${sub} mb-1`}>🎯 Goals ({goalsList.length})</div>
                      <div className="flex flex-wrap gap-1.5">
                        {goalsList.map((g, i) => (
                          <span key={i} className={`text-[11px] px-2 py-1 rounded-full ${day ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-cyan-900/30 text-cyan-200 border border-cyan-800'}`}>{g}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {dreamsList.length > 0 && (
                    <div className="mb-2.5">
                      <div className={`text-[10px] font-bold uppercase tracking-wide ${sub} mb-1`}>🌟 Dreams</div>
                      <div className="flex flex-wrap gap-1.5">
                        {dreamsList.map((d, i) => (
                          <span key={i} className={`text-[11px] px-2 py-1 rounded-full ${day ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-purple-900/30 text-purple-200 border border-purple-800'}`}>{d}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {obstaclesList.length > 0 && (
                    <div>
                      <div className={`text-[10px] font-bold uppercase tracking-wide ${sub} mb-1`}>⛰️ Obstacles</div>
                      <div className="flex flex-wrap gap-1.5">
                        {obstaclesList.map((o, i) => (
                          <span key={i} className={`text-[11px] px-2 py-1 rounded-full ${day ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-pink-900/30 text-pink-200 border border-pink-800'}`}>{o}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* ═══════════════════
              TRACK / LIST toggle — centered, below the main nav
             ═══════════════════ */}
          <div className="pt-4 w-full flex justify-center">
            <div className={`inline-flex rounded-full border overflow-hidden text-xs font-bold shadow-sm ${day ? 'border-slate-200 bg-white/70' : 'border-indigo-700 bg-indigo-950/60'}`}>
              <button onClick={() => setLayoutMode('track')} className={`px-4 py-1.5 transition-all ${layoutMode === 'track' ? `bg-gradient-to-r ${accent} text-white` : `${sub} hover:opacity-70`}`}>🏁 Track View</button>
              <button onClick={() => setLayoutMode('list')} className={`px-4 py-1.5 transition-all ${layoutMode === 'list' ? `bg-gradient-to-r ${accent} text-white` : `${sub} hover:opacity-70`}`}>📋 List View</button>
            </div>
          </div>

          {/* Track shape sub-toggle — As One vs Separate parallel tracks */}
          {layoutMode === 'track' && (
            <div className="pt-2 w-full flex justify-center">
              <div className={`inline-flex rounded-full border overflow-hidden text-[11px] font-bold ${day ? 'border-slate-200 bg-white/60' : 'border-indigo-700 bg-indigo-950/50'}`}>
                <button onClick={() => setTrackShape('trail')} className={`px-3 py-1 transition-all ${trackShape === 'trail' ? (day ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white') : `${sub} hover:opacity-70`}`}>🗺️ Trail Map</button>
                <button onClick={() => setTrackShape('one')} className={`px-3 py-1 transition-all ${trackShape === 'one' ? (day ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white') : `${sub} hover:opacity-70`}`}>🛣️ As One</button>
                <button onClick={() => setTrackShape('separate')} className={`px-3 py-1 transition-all ${trackShape === 'separate' ? (day ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white') : `${sub} hover:opacity-70`}`}>🏁 Separate Races</button>
              </div>
            </div>
          )}

          {/* ═══════════════════
              SHARED TOP (1 of 2) — Stats + ResourceHub + Hare World.
              Odosa: "the track view AND list view should BOTH have the Stats
              and ResourceHub & Hare World options that only the list view
              currently has." Ungated, and first in the order for both views.
             ═══════════════════ */}
            <div className="w-full max-w-2xl px-2 pt-5 space-y-3">
              {/* Stats (moved to the top) */}
              {gamifiedMode ? (
                <div className={`${pill} border rounded-xl p-3 shadow-sm`}>
                  <div className={`font-bold text-xs mb-2 ${txt} flex items-center gap-1`}>✨ Stats</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {stats.map((s, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[10px] ${sub}`}>{s.name}</span>
                          <span className={`text-[10px] font-bold ${txt}`}>{s.value} XP</span>
                        </div>
                        <div className={`h-1.5 ${day ? 'bg-sky-100' : 'bg-indigo-800'} rounded-full overflow-hidden`}>
                          <div className={`h-full rounded-full ${s.value >= 7 ? 'bg-sky-400' : 'bg-indigo-400'}`} style={{ width: `${(s.value / s.max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => setGamifiedMode(false)} className={`text-[8px] ${sub} hover:underline`}>Hide stats</button>
                    <Link href="/stats" className={`text-[8px] font-bold ${day ? 'text-emerald-600' : 'text-emerald-300'} hover:underline`}>See full breakdown →</Link>
                  </div>
                </div>
              ) : (
                <button onClick={() => setGamifiedMode(true)} className={`text-[10px] ${sub} hover:underline`}>Show stats</button>
              )}

              {/* ResourceHub + Hare World (moved up) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`${day ? 'bg-amber-50/90 border-amber-300' : 'bg-indigo-900/70 border-indigo-600'} border-2 rounded-xl shadow-md p-3 flex flex-col`}>
                  <h4 className={`font-bold text-xs mb-1 ${txt}`}>🏪 ResourceHub</h4>
                  <p className={`text-[10px] ${sub} mb-2 flex-1`}>Curated tools, services &amp; support matched to the barriers you face and your goals.</p>
                  <a href={goHubHref('/')} target="_blank" rel="noopener noreferrer" className={`block text-center text-[10px] font-bold px-3 py-1.5 rounded-lg shadow transition-all hover:scale-105 ${day ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'}`}>Go to ResourceHub →</a>
                </div>
                <div className={`${day ? 'bg-purple-50/90 border-purple-300' : 'bg-indigo-900/70 border-purple-600'} border-2 rounded-xl shadow-md p-3 flex flex-col`}>
                  <h4 className={`font-bold text-xs mb-1 ${txt}`}>🐰 Hare World</h4>
                  <p className={`text-[10px] ${sub} mb-2 flex-1`}>Your role models, mentors &amp; people — see who&apos;s ahead and learn from them.</p>
                  <Link href="/pit-stop?tab=haveworld&view=people" className={`block text-center text-[10px] font-bold px-3 py-1.5 rounded-lg shadow transition-all hover:scale-105 ${day ? 'bg-gradient-to-r from-purple-400 to-pink-500 text-white' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'}`}>Go to Hare World →</Link>
                </div>
              </div>
            </div>

          {/* ═══════════════════
              SHARED TOP (2 of 2) — Dream Self, hovering figure through
              "See more" ONLY. Odosa: both views get this, second.
              The Stats / goals grid / "Add another goal" / "Today's
              Motivation" that used to sit under it in Track View are
              deleted — the block above already covers stats, and the race
              track below covers the goal. Anything view-specific comes
              AFTER this point.
             ═══════════════════ */}
          <div className="pt-8 flex flex-col items-center">
            <div className="relative dg rounded-full p-4 mb-1">
              <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-28 h-8 rounded-full blur-lg ${day ? 'bg-white/60' : 'bg-indigo-300/15'}`} />
              <div className="bn relative">
                <svg viewBox="0 0 120 150" className="w-20 h-28">
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => { const r = a * Math.PI / 180; return <line key={i} x1={60 + 26 * Math.cos(r)} y1={48 + 26 * Math.sin(r)} x2={60 + 44 * Math.cos(r)} y2={48 + 44 * Math.sin(r)} stroke={day ? '#bae6fd' : '#6366f1'} strokeWidth="1.5" strokeDasharray="4" opacity=".5" /> })}
                  <circle cx="60" cy="32" r="14" fill="none" stroke={stroke} strokeWidth="3" />
                  <path d="M54 30 Q56 27 58 30" fill="none" stroke={stroke} strokeWidth="1.5" />
                  <path d="M62 30 Q64 27 66 30" fill="none" stroke={stroke} strokeWidth="1.5" />
                  <path d="M54 37 Q60 44 66 37" fill="none" stroke={stroke} strokeWidth="2" />
                  <line x1="60" y1="46" x2="60" y2="85" stroke={stroke} strokeWidth="3" />
                  <line x1="60" y1="58" x2="42" y2="46" stroke={stroke} strokeWidth="3" />
                  <line x1="60" y1="58" x2="78" y2="46" stroke={stroke} strokeWidth="3" />
                  <text x="34" y="44" fontSize="11">⭐</text>
                  <text x="74" y="44" fontSize="11">⭐</text>
                  <line x1="60" y1="85" x2="48" y2="110" stroke={stroke} strokeWidth="3" />
                  <line x1="60" y1="85" x2="72" y2="110" stroke={stroke} strokeWidth="3" />
                  <circle cx="60" cy="14" r="6" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3" />
                </svg>
              </div>
            </div>
            <div className={`text-lg font-bold bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>Dream Self</div>
            <div className={`text-xs ${sub} mb-1`}>{(payload?.userProfile?.dreams || [])[0] || 'Cloud 9 — Your ideal future'}</div>
            <Link href="/ideal-self" className={`text-[10px] font-bold ${day ? 'text-purple-600' : 'text-purple-300'} hover:underline`}>✨ See more →</Link>
          </div>

          {/* ═══════════════════════════════════════════════════
              CHECKLIST VIEW — One dimension at a time
              Each dimension can contain multiple races (sub-races).
              Individual vs Combined view toggle.
              Next milestone selection after completing milestones.
             ═══════════════════════════════════════════════════ */}
          {showChecklist && (() => {
            const dimOrder = dimMeta
            // Sub-races per dimension, built from the user's REAL milestones.
            //
            // This block used to be ~57 hardcoded steps ("Set up a structured
            // study schedule", "Use noise-canceling headphones for focus", …) with
            // the agent milestones PUSHED ONTO the end of them. That meant a
            // signed-in user saw the mock plan first and their own plan beneath
            // it — the mock never got displaced, so testers were reading and
            // reporting on invented steps. The mock is gone. Lanes are grouped
            // from real milestones by dimension, and a dimension with nothing in
            // it now says so rather than inventing content.
            type SubStep = { id: string; name: string; status: 'active' | 'upcoming' | 'far'; isGeneric?: boolean }
            type SubRace = { id: string; name: string; steps: SubStep[] }
            const dimSubRaces: Record<string, SubRace[]> = {}

            milestones.forEach((m: any) => {
              const k = String(m.dimension || '').toLowerCase()
              const norm = k === 'career' ? 'workplace' : k
              if (!norm) return
              // Lanes come from the agent's own grouping (the milestone's goal).
              // Milestones with no goal share a single lane for the dimension.
              const laneName = m.goal || 'Your plan'
              const laneId = `${norm}-${laneName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`
              if (!dimSubRaces[norm]) dimSubRaces[norm] = []
              let lane = dimSubRaces[norm].find(l => l.id === laneId)
              if (!lane) {
                lane = { id: laneId, name: laneName, steps: [] }
                dimSubRaces[norm].push(lane)
              }
              if (!lane.steps.find(s => s.id === m.id)) {
                lane.steps.push({ id: m.id, name: m.name, status: m.status })
              }
            })

            // Barrier lane is generated from the live recommendations, not a list.
            const barrierSteps: SubStep[] = recommendedChoices
              .filter(ch => ch.id !== 'see')
              .map((ch, idx) => ({
                id: ch.id,
                name: ch.name,
                status: (idx === 0 ? 'active' : idx < 3 ? 'upcoming' : 'far') as 'active' | 'upcoming' | 'far',
              }))
            if (barrierSteps.length > 0) {
              dimSubRaces.barrier = [{ id: 'barrier-main', name: 'Barrier Support', steps: barrierSteps }]
            }

            const activeDim = dimOrder.find(d => d.key === activeDimension) || dimOrder[0]
            const subRaces = dimSubRaces[activeDim.key] || []
            const activeSubRace = activeDimRace ? subRaces.find(r => r.id === activeDimRace) : subRaces[0]
            // For combined view, merge all sub-race steps
            const combinedSteps = subRaces.flatMap(r => r.steps.map(s => ({ ...s, raceName: r.name })))

            // Find the last completed milestone index to determine if branching should show
            const displaySteps = dimViewMode === 'individual' && activeSubRace ? activeSubRace.steps : combinedSteps
            const lastCompletedIdx = displaySteps.findIndex((s, i) => {
              // Find first non-completed step → the one before it is last completed
              return !completedMilestoneIds.has(s.id)
            })
            const hasMilestoneJustCompleted = lastCompletedIdx > 0 // At least one step is completed
            // Next milestone options (branching) - only show if a milestone was just completed
            const nextMilestoneOptions = hasMilestoneJustCompleted && lastCompletedIdx < displaySteps.length
              ? [
                  { id: 'opt-a', label: 'Continue on current path', desc: displaySteps[lastCompletedIdx]?.name || 'Next step' },
                  { id: 'opt-b', label: 'Explore alternative approach', desc: 'Try a different strategy for this milestone' },
                  { id: 'opt-c', label: 'Skip to next milestone', desc: 'Jump ahead if you feel ready' },
                ]
              : []

            return (
              <div className="w-full px-4 py-6">
                {/* Header */}
                <div className={`text-center mb-2 font-bold text-sm ${txt}`}>
                  📋 Checklist View
                </div>
                <div className={`text-center mb-4 text-[10px] ${sub}`}>
                  One dimension at a time · Switch between races
                </div>

                {/* Individual | Combined toggle — always available */}
                <div className="flex justify-center mb-4">
                  <div className={`inline-flex rounded-lg border overflow-hidden text-[10px] font-bold ${day ? 'border-slate-200' : 'border-indigo-700'}`}>
                    <button onClick={() => setDimViewMode('individual')} className={`px-3 py-1 ${dimViewMode === 'individual' ? (day ? 'bg-white text-slate-800' : 'bg-indigo-700 text-white') : (day ? 'bg-slate-50 text-slate-400' : 'bg-indigo-950 text-indigo-500')}`}>Individual</button>
                    <button onClick={() => setDimViewMode('combined')} className={`px-3 py-1 ${dimViewMode === 'combined' ? (day ? 'bg-white text-slate-800' : 'bg-indigo-700 text-white') : (day ? 'bg-slate-50 text-slate-400' : 'bg-indigo-950 text-indigo-500')}`}>Combined</button>
                  </div>
                </div>

                {dimViewMode === 'combined' ? (
                  /* ══ COMBINED — four life dimensions, one goal ══ */
                  <div className="w-full">
                    <div className={`text-center mb-3 text-[11px] font-bold ${txt}`}>🏠 Four life dimensions, one goal</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
                      {dimOrder.filter(d => d.key !== 'barrier').map(dim => {
                        const lanes = dimSubRaces[dim.key] || []
                        const laneSteps = lanes[0]?.steps || []
                        return (
                          <div key={dim.key} className={`rounded-2xl border bg-gradient-to-b ${day ? dim.tint : dim.tintDark} p-3 shadow-sm`}>
                            <div className={`flex items-center gap-1.5 font-bold text-[11px] mb-1 ${txt}`}>
                              <span className="text-base">{dim.emoji}</span>
                              <span className="uppercase tracking-wider">{dim.label}</span>
                            </div>
                            {userBarrierLabels.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {userBarrierLabels.slice(0, 3).map(b => (<span key={b} className={`text-[7px] px-1 py-0.5 rounded-full border ${day ? 'bg-white/70 text-slate-600 border-slate-200' : 'bg-indigo-900/60 text-indigo-300 border-indigo-700'}`}>{b}</span>))}
                              </div>
                            )}
                            <div className={`text-[9px] font-bold mb-2 ${txt}`}>🎯 {goalForDim(dim.key, dim.goal)}</div>
                            <div className="relative pl-4">
                              <div className={`absolute left-1.5 top-1 bottom-1 w-[2px] ${day ? 'bg-slate-300' : 'bg-indigo-700'}`} />
                              {laneSteps.map((step, i) => {
                                const isCompleted = completedMilestoneIds.has(step.id)
                                return (
                                  <div key={step.id} className={`relative mb-1.5 p-1.5 rounded-lg border ${isCompleted ? (day ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-900/30 border-emerald-700') : step.status === 'active' ? (day ? 'bg-amber-50 border-amber-400' : 'bg-amber-900/50 border-amber-600') : (day ? 'bg-white border-slate-200' : 'bg-indigo-950/40 border-indigo-700')}`}>
                                    <span className={`absolute -left-[13px] top-2 w-3 h-3 rounded-full ring-2 ${day ? 'ring-white' : 'ring-slate-900'} ${isCompleted ? 'bg-emerald-500' : step.status === 'active' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : (day ? 'bg-sky-400' : 'bg-sky-600')}`} />
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <span className="text-[8px]">{isCompleted ? '✅' : step.status === 'active' ? '📍' : '🪧'}</span>
                                      <span className={`text-[7px] font-mono ${sub}`}>Step {i + 1}</span>
                                      {step.status === 'active' && !isCompleted && <span className="text-[7px] font-bold text-amber-500 ml-auto">HERE</span>}
                                    </div>
                                    <div className={`text-[9px] font-bold leading-snug ${isCompleted ? 'line-through opacity-60' : ''} ${txt}`}>{step.name}</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (<>
                {/* ── Dimension tab bar ── */}
                <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                  {dimOrder.map(dim => (
                    <button
                      key={dim.key}
                      onClick={() => { setActiveDimension(dim.key); setActiveDimRace(null) }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${activeDimension === dim.key
                        ? `${day ? 'bg-white shadow-md border-slate-300 text-slate-800' : 'bg-indigo-800 shadow-md border-indigo-500 text-white'} scale-105`
                        : `${day ? 'bg-white/60 border-slate-200 text-slate-500 hover:bg-white/80' : 'bg-indigo-950/40 border-indigo-700 text-indigo-400 hover:bg-indigo-900/60'}`
                      }`}
                    >
                      <span>{dim.emoji}</span>
                      <span className="hidden sm:inline">{dim.label}</span>
                    </button>
                  ))}
                </div>

                {/* ── Active dimension card ── */}
                <div className={`rounded-2xl border bg-gradient-to-b ${day ? activeDim.tint : activeDim.tintDark} p-4 shadow-sm backdrop-blur-sm max-w-lg mx-auto`}>
                  {/* Dimension header */}
                  <div className={`flex items-center justify-between mb-3`}>
                    <div className={`flex items-center gap-2 font-bold text-sm ${txt}`}>
                      <span className="text-lg">{activeDim.emoji}</span>
                      <span className="uppercase tracking-wider">{activeDim.label}</span>
                    </div>
                  </div>

                  {/* Barriers chips */}
                  <div className="flex flex-wrap items-center gap-1 mb-3">
                    {userBarrierLabels.slice(0, 6).map(b => (
                      <span key={b} className={`inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full ${day ? 'bg-white/70 text-slate-600' : 'bg-indigo-900/60 text-indigo-300'} border ${day ? 'border-slate-200' : 'border-indigo-700'}`}>
                        {b}
                        {extraBarriers.includes(b) && (
                          <button
                            onClick={() => setExtraBarriers(prev => prev.filter(x => x !== b))}
                            className="hover:text-red-500"
                            title="Remove"
                          >
                            <X className="w-2 h-2" />
                          </button>
                        )}
                      </span>
                    ))}
                    {addingBarrier ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          autoFocus
                          value={newBarrierText}
                          onChange={(e) => setNewBarrierText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const v = newBarrierText.trim()
                              if (v && !userBarrierLabels.includes(v)) setExtraBarriers(prev => [...prev, v])
                              setNewBarrierText(''); setAddingBarrier(false)
                            } else if (e.key === 'Escape') {
                              setNewBarrierText(''); setAddingBarrier(false)
                            }
                          }}
                          placeholder="Add barrier…"
                          className={`text-[8px] px-1.5 py-0.5 rounded-full border w-24 focus:outline-none ${day ? 'bg-white border-slate-300 text-slate-700' : 'bg-indigo-950 border-indigo-600 text-indigo-200'}`}
                        />
                        <button
                          onClick={() => {
                            const v = newBarrierText.trim()
                            if (v && !userBarrierLabels.includes(v)) setExtraBarriers(prev => [...prev, v])
                            setNewBarrierText(''); setAddingBarrier(false)
                          }}
                          className={`text-[8px] font-bold ${day ? 'text-cyan-600' : 'text-cyan-300'}`}
                        >
                          Add
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setAddingBarrier(true)}
                        className={`text-[8px] px-1.5 py-0.5 rounded-full border border-dashed font-bold ${day ? 'border-slate-300 text-slate-500 hover:bg-white/70' : 'border-indigo-600 text-indigo-300 hover:bg-indigo-900/40'}`}
                        title="Add a barrier/condition to consider here"
                      >
                        + Add
                      </button>
                    )}
                  </div>

                  {/* Goal(s) for this dimension — shown under the barrier chips */}
                  <div className={`mb-3 px-2.5 py-2 rounded-lg border ${day ? 'bg-white/70 border-slate-200' : 'bg-indigo-950/40 border-indigo-700'}`}>
                    <div className={`text-[8px] font-bold uppercase tracking-wider ${sub}`}>🎯 Goal</div>
                    <div className={`text-[11px] font-bold leading-snug ${txt}`}>{goalForDim(activeDim.key, activeDim.goal)}</div>
                  </div>

                  {/* Sub-race tabs (only in individual mode, only if > 1 race) */}
                  {dimViewMode === 'individual' && subRaces.length > 1 && (
                    <div className="flex gap-1.5 mb-3">
                      {subRaces.map(sr => (
                        <button
                          key={sr.id}
                          onClick={() => setActiveDimRace(sr.id)}
                          className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${(activeDimRace === sr.id || (!activeDimRace && sr.id === subRaces[0].id))
                            ? `${day ? 'bg-white border-slate-300 shadow-sm text-slate-800' : 'bg-indigo-800 border-indigo-500 text-white'}`
                            : `${day ? 'bg-white/40 border-slate-200 text-slate-500' : 'bg-indigo-950/30 border-indigo-700 text-indigo-400'}`
                          }`}
                        >
                          {sr.name}
                          <span className={`ml-1 text-[8px] ${day ? 'text-slate-400' : 'text-indigo-500'}`}>{sr.steps.length} steps</span>
                          {/* Liam: a bar per path reads faster than counting check marks. */}
                          {(() => {
                            const srDone = sr.steps.filter(st => completedMilestoneIds.has(st.id)).length
                            const srPct = sr.steps.length ? Math.round((srDone / sr.steps.length) * 100) : 0
                            return (
                              <div className={`h-1 rounded-full overflow-hidden mt-1 ${day ? 'bg-slate-200' : 'bg-indigo-900'}`}>
                                <div className="h-full bg-gradient-to-r from-sky-400 to-purple-400 rounded-full transition-all" style={{ width: `${srPct}%` }} />
                              </div>
                            )
                          })()}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Nothing to show for this dimension. Says so, rather than
                      falling back to invented steps the way this page used to. */}
                  {displaySteps.length === 0 && (
                    <div className={`rounded-xl border-2 border-dashed p-5 text-center ${day ? 'border-slate-300 bg-white/50' : 'border-indigo-700 bg-indigo-950/30'}`}>
                      <div className="text-2xl mb-1">🗺️</div>
                      <div className={`text-xs font-bold ${txt}`}>No steps here yet</div>
                      <p className={`text-[10px] mt-1 ${sub}`}>
                        Your plan hasn&apos;t produced any {activeDim.label} steps yet. Add a goal in
                        this area and the agents will build the path.
                      </p>
                      <button
                        onClick={() => router.push('/onboarding?step=3')}
                        className={`mt-3 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r ${accent} text-white shadow hover:scale-105 transition-all`}
                      >
                        ➕ Add a goal
                      </button>
                    </div>
                  )}

                  {/* Progress for the path on screen (Liam). Check marks alone
                      made it hard to see how far along a path you actually are. */}
                  {(() => {
                    const shown = activeSubRace ? activeSubRace.steps : combinedSteps
                    if (shown.length === 0) return null
                    const doneCount = shown.filter(st => completedMilestoneIds.has(st.id)).length
                    const pct = Math.round((doneCount / shown.length) * 100)
                    return (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold ${txt}`}>
                            {activeSubRace ? activeSubRace.name : 'All steps'} progress
                          </span>
                          <span className={`text-[10px] font-bold ${txt}`}>
                            {doneCount}/{shown.length} · {pct}%
                          </span>
                        </div>
                        <div className={`h-2 rounded-full overflow-hidden ${day ? 'bg-slate-200' : 'bg-indigo-900'}`}>
                          <div className="h-full bg-gradient-to-r from-sky-400 to-purple-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Steps list */}
                  <div className="relative pl-5">
                    {/* Lane road line */}
                    <div className={`absolute left-2 top-2 bottom-2 w-[2px] ${day ? 'bg-slate-300' : 'bg-indigo-700'}`} />

                    {(activeSubRace ? activeSubRace.steps : combinedSteps).map((step, i, arr) => {
                      const isCompleted = completedMilestoneIds.has(step.id)
                      const isHearted = heartedGoals.has(step.id)
                      // After a completed milestone, check if we should show branching
                      const justCompletedMilestone = isCompleted && i < arr.length - 1 && !completedMilestoneIds.has(arr[i + 1].id)

                      return (
                        <div key={step.id}>
                          <div
                            className={`relative w-full text-left mb-2 p-2.5 rounded-lg border transition-all ${
                              isCompleted
                                ? `${day ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-900/30 border-emerald-700'}`
                                : step.status === 'active' && !isCompleted
                                  ? `${day ? 'bg-amber-50 border-amber-400' : 'bg-amber-900/50 border-amber-600'} shadow-sm`
                                  : step.status === 'upcoming'
                                    ? `${day ? 'bg-white border-slate-200' : 'bg-indigo-950/40 border-indigo-700'}`
                                    : `${day ? 'bg-white/60 border-slate-200' : 'bg-indigo-950/30 border-indigo-800'} opacity-70`
                            }`}
                          >
                            {/* Node dot */}
                            <span className={`absolute -left-[18px] top-3.5 w-3.5 h-3.5 rounded-full ring-2 ${day ? 'ring-white' : 'ring-slate-900'} ${
                              isCompleted ? 'bg-emerald-500' : step.status === 'active' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : step.status === 'upcoming' ? (day ? 'bg-sky-400' : 'bg-sky-600') : (day ? 'bg-slate-300' : 'bg-slate-600')
                            }`} />

                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="text-[10px]">{isCompleted ? '✅' : step.status === 'active' ? '📍' : '🪧'}</span>
                                  <span className={`text-[9px] font-mono ${sub}`}>Step {i + 1}</span>
                                  {step.status === 'active' && !isCompleted && <span className="text-[8px] font-bold text-amber-500 ml-auto">YOU ARE HERE</span>}
                                </div>
                                <div className={`text-[11px] font-bold leading-snug ${isCompleted ? 'line-through opacity-60' : ''} ${txt}`}>{step.name}</div>
                                {(step as any).isGeneric && !isCompleted && (
                                  <div className={`text-[8px] mt-0.5 italic ${sub}`}>Generic step — will refine after milestone</div>
                                )}
                              </div>
                              {/* Heart + Complete buttons */}
                              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); toggleHeart(step.id) }} className={`text-sm transition-transform hover:scale-125 ${isHearted ? '' : 'opacity-40 hover:opacity-70'}`}>
                                  {isHearted ? '❤️' : '🤍'}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); toggleMilestoneComplete(step.id) }} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isCompleted ? `${day ? 'bg-emerald-500 border-emerald-500' : 'bg-emerald-600 border-emerald-600'}` : `${day ? 'border-slate-300 hover:border-emerald-400' : 'border-indigo-600 hover:border-emerald-500'}`}`}>
                                  {isCompleted && <span className="text-white text-[8px] font-bold">✓</span>}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* ── Branching: 3 options after a completed milestone ── */}
                          {justCompletedMilestone && !dismissedBranches.has(step.id) && (
                            <div className={`ml-2 mb-3 p-3 rounded-xl border ${day ? 'bg-purple-50/80 border-purple-200' : 'bg-purple-900/20 border-purple-700'}`}>
                              <div className={`text-[10px] font-bold mb-2 ${txt}`}>🔀 Choose your next path:</div>
                              <div className="space-y-1.5">
                                {[
                                  { id: 'opt-a', label: 'Continue on current path', desc: arr[i + 1]?.name || 'Next step', icon: '➡️' },
                                  { id: 'opt-b', label: 'Explore alternative approach', desc: 'Try a different strategy', icon: '🔄' },
                                  { id: 'opt-c', label: 'Skip to next milestone', desc: 'Jump ahead if ready', icon: '⏩' },
                                ].map(opt => (
                                  <button
                                    key={opt.id}
                                    onClick={() => {
                                      const nextId = arr[i + 1]?.id
                                      if (opt.id === 'opt-c' && nextId) {
                                        // Skip ahead: complete the next milestone (this
                                        // prompt then hides itself as it's no longer "just
                                        // completed").
                                        toggleMilestoneComplete(nextId)
                                      } else if (opt.id === 'opt-b') {
                                        // Explore alternatives: open the Milestone view,
                                        // where the tools / strategies live.
                                        router.push('/milestones')
                                      } else {
                                        // Continue on current path: acknowledge & dismiss.
                                        setDismissedBranches(prev => new Set(prev).add(step.id))
                                      }
                                    }}
                                    className={`w-full flex items-start gap-2 p-2 rounded-lg border text-left transition-all hover:shadow-sm hover:scale-[1.01] ${day ? 'bg-white border-slate-200 hover:border-purple-300' : 'bg-indigo-950/40 border-indigo-700 hover:border-purple-500'}`}
                                  >
                                    <span className="text-sm mt-0.5">{opt.icon}</span>
                                    <div>
                                      <div className={`text-[10px] font-bold ${txt}`}>{opt.label}</div>
                                      <div className={`text-[9px] ${sub}`}>{opt.desc}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Nav arrows to switch dimensions */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-dashed" style={{ borderColor: day ? '#e2e8f0' : '#312e81' }}>
                    <button
                      onClick={() => {
                        const idx = dimOrder.findIndex(d => d.key === activeDimension)
                        const prev = dimOrder[(idx - 1 + dimOrder.length) % dimOrder.length]
                        setActiveDimension(prev.key); setActiveDimRace(null)
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold ${day ? 'bg-white/60 text-slate-600 hover:bg-white' : 'bg-indigo-950/40 text-indigo-400 hover:bg-indigo-900'} transition-all`}
                    >
                      ← {dimOrder[(dimOrder.findIndex(d => d.key === activeDimension) - 1 + dimOrder.length) % dimOrder.length].label}
                    </button>
                    <span className={`text-[9px] ${sub}`}>{dimOrder.findIndex(d => d.key === activeDimension) + 1} / {dimOrder.length}</span>
                    <button
                      onClick={() => {
                        const idx = dimOrder.findIndex(d => d.key === activeDimension)
                        const next = dimOrder[(idx + 1) % dimOrder.length]
                        setActiveDimension(next.key); setActiveDimRace(null)
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold ${day ? 'bg-white/60 text-slate-600 hover:bg-white' : 'bg-indigo-950/40 text-indigo-400 hover:bg-indigo-900'} transition-all`}
                    >
                      {dimOrder[(dimOrder.findIndex(d => d.key === activeDimension) + 1) % dimOrder.length].label} →
                    </button>
                  </div>
                </div>
                </>)}
              </div>
            )
          })()}

          {/* ═══════════════════════════════════════════════════
              SEPARATE RACES — parallel dimension tracks
              Each life dimension runs as its own vertical track,
              fanning out from the Dream Self and converging at the
              shared start line.  (Track View · "Separate" shape)
             ═══════════════════════════════════════════════════ */}
          {/* Trail Map — the whole path as zones (gamified level-map view). */}
          {showTrail && (
            <div className="w-full px-2 pt-4 pb-10">
              {milestones.length === 0 ? (
                <div className={`max-w-md mx-auto text-center rounded-2xl border-2 border-dashed p-6 ${day ? 'border-slate-300 bg-white/60' : 'border-indigo-700 bg-indigo-950/40'}`}>
                  <div className="text-3xl mb-2">🗺️</div>
                  <div className={`text-sm font-bold ${txt}`}>No trail yet</div>
                  <p className={`text-xs mt-1 ${sub}`}>Finish onboarding and your milestones become the map.</p>
                </div>
              ) : (
                <MilestoneTrail
                  milestones={milestones as any}
                  completedIds={completedMilestoneIds}
                  currentIndex={milestones.findIndex((m: any) => m.status === 'active') >= 0
                    ? milestones.findIndex((m: any) => m.status === 'active')
                    : 0}
                  onSelect={() => router.push('/milestones')}
                  day={day}
                />
              )}
            </div>
          )}

          {showSeparateTrack && (
            <div className="w-full pt-6">
              {/* Dream Self renders once in the shared top block above. */}
              <FanOut count={5} />
              <div className={`text-center mb-3 text-[10px] ${sub}`}>Each life dimension runs as its own parallel track</div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {dimMeta.map(dim => {
                  const dimMs = milestones.filter((m: any) => _normDim(m.dimension) === dim.key)
                  const steps: { id: string; name: string; status: 'active' | 'upcoming' | 'far' }[] = dimMs.length
                    ? dimMs.map((m: any) => ({ id: m.id, name: m.name, status: m.status }))
                    : dim.key === 'barrier'
                      ? recommendedChoices.filter(c => c.id !== 'see').map((c, idx) => ({ id: c.id, name: c.name, status: (idx === 0 ? 'active' : idx < 2 ? 'upcoming' : 'far') as 'active' | 'upcoming' | 'far' }))
                      : [{ id: `${dim.key}-ph`, name: 'Getting started', status: 'active' as const }]
                  const done = steps.filter(s => completedMilestoneIds.has(s.id)).length
                  const pct = Math.round((done / steps.length) * 100)
                  return (
                    <div key={dim.key} className={`rounded-2xl border bg-gradient-to-b ${day ? dim.tint : dim.tintDark} p-3 shadow-sm`}>
                      <div className={`flex items-center gap-1.5 font-bold text-[11px] mb-1 ${txt}`}>
                        <span className="text-base">{dim.emoji}</span>
                        <span className="uppercase tracking-wider truncate">{dim.label}</span>
                      </div>
                      <div className={`text-[9px] font-bold mb-1.5 ${txt} leading-snug`}>🎯 {goalForDim(dim.key, dim.goal)}</div>
                      <div className={`h-1.5 ${day ? 'bg-white/70' : 'bg-indigo-900/60'} rounded-full overflow-hidden mb-2`}>
                        <div className={`h-full rounded-full bg-gradient-to-r ${accent}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="relative pl-4">
                        <div className={`absolute left-1.5 top-1 bottom-1 w-[2px] ${day ? 'bg-slate-300' : 'bg-indigo-700'}`} />
                        {steps.map((step, i) => {
                          const isCompleted = completedMilestoneIds.has(step.id)
                          return (
                            <button
                              key={step.id}
                              onClick={() => toggleMilestoneComplete(step.id)}
                              className={`relative w-full text-left mb-1.5 p-1.5 rounded-lg border transition-all ${isCompleted ? (day ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-900/30 border-emerald-700') : step.status === 'active' ? (day ? 'bg-amber-50 border-amber-400' : 'bg-amber-900/50 border-amber-600') : (day ? 'bg-white border-slate-200' : 'bg-indigo-950/40 border-indigo-700')}`}
                            >
                              <span className={`absolute -left-[13px] top-2 w-3 h-3 rounded-full ring-2 ${day ? 'ring-white' : 'ring-slate-900'} ${isCompleted ? 'bg-emerald-500' : step.status === 'active' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : (day ? 'bg-sky-400' : 'bg-sky-600')}`} />
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-[8px]">{isCompleted ? '✅' : step.status === 'active' ? '📍' : '🪧'}</span>
                                <span className={`text-[7px] font-mono ${sub}`}>Step {i + 1}</span>
                                {step.status === 'active' && !isCompleted && <span className="text-[7px] font-bold text-amber-500 ml-auto">HERE</span>}
                              </div>
                              <div className={`text-[9px] font-bold leading-snug ${isCompleted ? 'line-through opacity-60' : ''} ${txt}`}>{step.name}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <FanIn count={5} />
              {/* Shared finish line */}
              <div className="flex flex-col items-center my-2">
                <div className="flex mb-2">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className={`w-4 h-4 ${(Math.floor(i / 1) + (i % 2)) % 2 === 0 ? (day ? 'bg-slate-800' : 'bg-white') : (day ? 'bg-white' : 'bg-slate-800')} ${i === 0 ? 'rounded-l' : ''} ${i === 9 ? 'rounded-r' : ''}`} />
                  ))}
                </div>
                <span className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full shadow-md ${day ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-amber-900/70 text-amber-200 border border-amber-700'}`}>🏁 Start Line — Landing Spot</span>
              </div>

              {/* Storefronts */}
              <div className="flex justify-center"><StorefrontRow /></div>

              {/* Journal */}
              <div className="flex justify-center pb-10">
                <Link href="/reflection?contextType=race" className={`inline-flex items-center gap-2 px-5 py-2 border-2 rounded-xl font-medium hover:shadow-lg transition-all ${pill} ${txt} text-sm`}>
                  <Sparkles className="w-4 h-4" /> Journal / Reflection
                </Link>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════
              CURRENT PLACE — character on road (Track View · "As One")
             ═══════════════════════════════ */}
          {showContinuousTrack && (<>
          {/* Storefront row */}
          <StorefrontRow />
          <div className="w-full">
            {/* Floating clouds */}
            <div className="flex justify-center gap-6 mb-2">
              {[1, 2, 3].map(i => <div key={i} className={`rounded-full blur-sm cf ${day ? 'bg-white/50' : 'bg-indigo-300/10'}`} style={{ width: `${36 + i * 10}px`, height: `${14 + i * 4}px`, animationDelay: `${i * 1.2}s` }} />)}
            </div>

            {/* No generated path yet. This space used to be filled with mock
                milestones, which hid the fact that onboarding hadn't produced
                anything. Say it plainly and point at the fix instead. */}
            {trackStops.length === 0 && (
              <div className="flex justify-center px-2">
                <div className={`max-w-sm w-full text-center rounded-2xl border-2 border-dashed p-6 ${day ? 'border-slate-300 bg-white/60' : 'border-indigo-700 bg-indigo-950/40'}`}>
                  <div className="text-3xl mb-2">🏁</div>
                  <div className={`text-sm font-bold ${txt}`}>Your track hasn&apos;t been built yet</div>
                  <p className={`text-xs mt-1 ${sub}`}>
                    Finish onboarding and the agents will lay out your milestones here.
                  </p>
                  <button
                    onClick={() => router.push('/onboarding')}
                    className={`mt-4 text-xs font-bold px-4 py-2 rounded-xl bg-gradient-to-r ${accent} text-white shadow hover:scale-105 transition-all`}
                  >
                    Build my path →
                  </button>
                </div>
              </div>
            )}

            {/* ═══ THE RACE TRACK — five milestone dots on one path (Odosa) ═══
                One dot is the current milestone and carries "YOU ARE HERE";
                every dot is tappable ("Tap to view"). The Pit Stop Shop flanks
                the path on the left and the current-goal panel on the right —
                both are placed in the CURRENT dot's grid row, so they sit
                beside the path centred on where you actually are, rather than
                floating at the top of the page. */}
            {trackStops.length > 0 && (
            <div className="grid gap-x-3 px-2" style={{ gridTemplateColumns: '1fr auto 1fr' }}>

              {/* LEFT: Pit Stop Shop, in the current dot's row */}
              <div className="flex justify-end items-center" style={{ gridColumn: 1, gridRow: currentStopIdx + 1 }}>
                <div className="w-full max-w-[180px]">
                <div className={`relative w-full max-w-[180px] ${day ? 'bg-amber-50/90 border-amber-300' : 'bg-indigo-900/70 border-indigo-600'} border-2 rounded-b-xl shadow-md overflow-visible`}>
                  {/* Awning top */}
                  <div className={`aw relative -mt-1 mx-[-2px] h-6 rounded-t-lg overflow-hidden ${day ? 'bg-gradient-to-b from-red-500 to-red-600' : 'bg-gradient-to-b from-purple-600 to-purple-800'}`}>
                    <div className="absolute inset-0 flex">
                      {Array.from({ length: 7 }, (_, i) => (
                        <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-white/20' : ''}`} />
                      ))}
                    </div>
                    <div className={`absolute bottom-0 left-0 right-0 h-2 ${day ? 'bg-red-700' : 'bg-purple-900'}`} style={{ clipPath: 'polygon(0% 0%, 7% 100%, 14% 0%, 21% 100%, 28% 0%, 35% 100%, 42% 0%, 50% 100%, 57% 0%, 64% 100%, 71% 0%, 78% 100%, 85% 0%, 92% 100%, 100% 0%)' }} />
                  </div>
                  <div className="p-2.5">
                    <h4 className={`font-bold text-xs mb-1.5 ${txt}`}>🏪 Pit Stop Shop</h4>
                    <div className="space-y-1">
                      {shopItems.length === 0 && (
                        <p className={`text-[9px] ${sub} py-1`}>No items yet — they appear as your agents recommend tools.</p>
                      )}
                      {shopItems.slice(0, expandShop ? shopItems.length : 3).map((item, i) => (
                        <button key={i} className={`w-full flex items-center gap-1.5 p-1 rounded-lg text-left transition-all hover:scale-[1.02] ${day ? 'bg-white/60 hover:bg-white/90' : 'bg-indigo-800/40 hover:bg-indigo-700/50'}`}>
                          <span className="text-base">{item.emoji}</span>
                          <div>
                            <div className={`text-[10px] font-bold ${txt}`}>{item.name}</div>
                            <div className={`text-[8px] ${sub}`}>{item.cost}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {/* Up/Down scroll arrows */}
                    <div className="flex justify-center gap-2 mt-1.5">
                      <button onClick={() => setExpandShop(false)} className={`w-7 h-7 flex items-center justify-center rounded-lg border-2 ${day ? 'border-amber-400 bg-amber-100 text-amber-700' : 'border-indigo-500 bg-indigo-800 text-indigo-300'} hover:opacity-70 transition-all`}>
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => setExpandShop(true)} className={`w-7 h-7 flex items-center justify-center rounded-lg border-2 ${day ? 'border-amber-400 bg-amber-100 text-amber-700' : 'border-indigo-500 bg-indigo-800 text-indigo-300'} hover:opacity-70 transition-all`}>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <a href={goHubHref('/')} target="_blank" rel="noopener noreferrer" className={`block text-center text-[10px] font-bold mt-2 px-3 py-1.5 rounded-lg shadow transition-all hover:scale-105 ${day ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'}`}>🏪 Open Full Shop →</a>
                  </div>
                </div>
                </div>
              </div>

              {/* CENTRE: the path — one grid row per stop, so the flanking
                  panels can line up with whichever dot is current. */}
              {trackStops.map((stop: any, i: number) => {
                const isCurrent = i === currentStopIdx
                const isDone = i < currentStopIdx
                return (
                  <div key={stop.id} className="flex flex-col items-center" style={{ gridColumn: 2, gridRow: i + 1 }}>
                    {/* Road segment joining this dot to the one above it. */}
                    {i > 0 && (
                      <div className={`w-9 h-7 relative ${day ? 'bg-slate-300' : 'bg-indigo-800'}`}>
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-white/70" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, currentColor 0 6px, transparent 6px 12px)' }} />
                      </div>
                    )}
                    <button onClick={() => router.push('/milestones')} className="group flex items-center gap-2 py-1">
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                          isCurrent
                            ? 'bg-amber-400 border-amber-500 ring-4 ring-amber-200'
                            : isDone
                            ? 'bg-sky-400 border-sky-500'
                            : day ? 'bg-white border-slate-300' : 'bg-indigo-950 border-indigo-600'
                        }`}
                      />
                      <div className={`text-left rounded-lg border px-3 py-2 shadow-sm min-w-[190px] transition-all group-hover:shadow-md ${isCurrent ? (day ? 'bg-amber-50 border-amber-400' : 'bg-amber-900/40 border-amber-600') : pill}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[9px] font-semibold ${sub}`}>{isCurrent ? '📍' : isDone ? '✓' : '🏁'} Step {i + 1}</span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600">You are here</span>
                          )}
                        </div>
                        <div className={`text-xs font-bold mt-0.5 ${txt}`}>{stop.name}</div>
                        <div className={`text-[9px] mt-0.5 opacity-70 group-hover:underline ${sub}`}>Tap to view →</div>
                      </div>
                    </button>
                  </div>
                )
              })}

              {/* RIGHT: current goals + per-path progress, in the current dot's
                  row. The progress bars are Liam's ask — the check marks alone
                  made it hard to read how far along a path you actually are. */}
              <div className="flex justify-start items-center" style={{ gridColumn: 3, gridRow: currentStopIdx + 1 }}>
                <div className={`w-full max-w-[190px] ${pill} border-2 rounded-xl shadow-md p-2.5`}>
                  <h4 className={`font-bold text-xs mb-1.5 ${txt}`}>🏁 Current Goals</h4>
                  <div className="space-y-2">
                    {races.filter((r: any) => r.id !== 'r_placeholder').slice(0, 3).map((r: any) => (
                      <div key={r.id}>
                        <div className={`text-[10px] font-bold ${txt}`}>{r.name}</div>
                        <div className={`h-1.5 rounded-full overflow-hidden mt-0.5 ${day ? 'bg-sky-100' : 'bg-indigo-800'}`}>
                          <div className="h-full bg-gradient-to-r from-sky-400 to-purple-400 rounded-full transition-all" style={{ width: `${r.progress}%` }} />
                        </div>
                        <div className={`text-[9px] ${sub} mt-0.5`}>{r.progress}% · {r.milestone}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => router.push('/onboarding?step=3')} className={`w-full mt-2 text-[10px] font-bold px-2 py-1.5 rounded-lg border-2 border-dashed transition-all hover:opacity-80 ${txt}`}>➕ Add another goal</button>
                  {userBarrierLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {userBarrierLabels.slice(0, 5).map((b: string) => (
                        <span key={b} className={`text-[8px] px-1.5 py-0.5 rounded ${day ? 'bg-sky-100 text-sky-700' : 'bg-sky-900/50 text-sky-300'}`}>{b}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
            )}
          </div>



          {/* ─── ROAD: continues down ─── */}
          <RoadDown h={30} />

          {/* Previous steps */}
          <button onClick={() => setShowPreviousSteps(!showPreviousSteps)} className={`flex items-center gap-1 text-[10px] ${sub} hover:opacity-70`}>
            {showPreviousSteps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span className="italic">(previous steps)</span>
          </button>
          {showPreviousSteps && (
            <div className="space-y-1 max-w-[240px] mt-1 mb-1">
              {previousSteps.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-3.5 h-3.5 rounded-full bg-sky-400 flex items-center justify-center flex-shrink-0"><span className="text-white text-[7px]">✓</span></div>
                  <span className={sub}>{s.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* ─── ROAD: down to start line ─── */}
          <RoadDown h={60} />

          {/* ═══════════════════
              START LINE
             ═══════════════════ */}
          <div className="flex flex-col items-center mb-3">
            {/* Checkered start line */}
            <div className="flex mb-2">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className={`w-4 h-4 ${(Math.floor(i / 1) + (i % 2)) % 2 === 0 ? (day ? 'bg-slate-800' : 'bg-white') : (day ? 'bg-white' : 'bg-slate-800')} ${i === 0 ? 'rounded-l' : ''} ${i === 9 ? 'rounded-r' : ''}`} />
              ))}
            </div>
            <span className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full shadow-md ${day ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-amber-900/70 text-amber-200 border border-amber-700'}`}>🏁 Start Line — Landing Spot</span>
          </div>


          {/* Final road segment to journal */}
          <RoadDown h={50} />

          {/* Journal */}
          <div className="pb-10">
            <Link href="/reflection?contextType=race" className={`inline-flex items-center gap-2 px-5 py-2 border-2 rounded-xl font-medium hover:shadow-lg transition-all ${pill} ${txt} text-sm`}>
              <Sparkles className="w-4 h-4" /> Journal / Reflection
            </Link>
          </div>
          </>)}
        </div>

        {/* ═══ MOTIVATION PINWHEEL POPUP ═══ */}
        {showPinwheelPopup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPinwheelPopup(false)}>
            <div className={`relative ${day ? 'bg-white' : 'bg-indigo-950'} rounded-2xl shadow-2xl border ${day ? 'border-slate-200' : 'border-indigo-700'} p-8 max-w-sm w-full mx-4`} onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowPinwheelPopup(false)} className={`absolute top-3 right-3 ${sub} hover:opacity-60`}><X className="w-5 h-5" /></button>
              <h2 className={`text-lg font-bold ${txt} text-center mb-1`}>Motivation Pinwheel</h2>
              <p className={`text-xs ${sub} text-center mb-6`}>Spin to get today&apos;s motivation!</p>
              <div className="flex flex-col items-center">
                <button onClick={spinWheel} disabled={isWheelSpinning} className="relative mb-4">
                  <svg viewBox="0 0 50 50" className="w-40 h-40 transition-transform duration-[2000ms] ease-out" style={{ transform: `rotate(${wheelRotation}deg)` }}>
                    {[0, 60, 120, 180, 240, 300].map((a, i) => { const c = day ? ['#38bdf8', '#818cf8', '#f59e0b', '#34d399', '#f472b6', '#60a5fa'] : ['#0ea5e9', '#6366f1', '#d97706', '#059669', '#ec4899', '#3b82f6']; const sa = (a - 90) * Math.PI / 180, ea = (a + 60 - 90) * Math.PI / 180; return <path key={i} d={`M25 25 L${25 + 20 * Math.cos(sa)} ${25 + 20 * Math.sin(sa)} A20 20 0 0 1 ${25 + 20 * Math.cos(ea)} ${25 + 20 * Math.sin(ea)}Z`} fill={c[i]} stroke="white" strokeWidth="1" /> })}
                    <circle cx="25" cy="25" r="6" fill="white" stroke={line} strokeWidth="1" />
                    <text x="25" y="27" textAnchor="middle" fontSize="4" fontWeight="bold" fill={line}>SPIN</text>
                  </svg>
                </button>
                {todaysMotivation ? (
                  <div className={`text-center p-4 rounded-xl border ${day ? 'bg-amber-50 border-amber-200' : 'bg-amber-900/30 border-amber-700'}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${sub} mb-1`}>Today&apos;s Motivation</div>
                    <div className={`text-base italic ${txt}`}>&ldquo;{todaysMotivation}&rdquo;</div>
                  </div>
                ) : (
                  <p className={`text-sm ${sub}`}>Tap the wheel to spin!</p>
                )}
              </div>

              {/* Placement customization — records the user's choice */}
              <div className={`mt-6 pt-4 border-t ${day ? 'border-slate-200' : 'border-indigo-700'}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${sub} mb-2 text-center`}>Pinwheel placement</div>
                <div className="flex gap-2 justify-center">
                  {(['left', 'right'] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => updateLayout({ pinwheelSide: side })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                        prefs.layout.pinwheelSide === side
                          ? `bg-gradient-to-r ${accent} text-white`
                          : `${day ? 'bg-slate-100 text-slate-600' : 'bg-indigo-900 text-indigo-200'}`
                      }`}
                    >
                      {side === 'left' ? '← Left' : 'Right →'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function RacesView() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-lg">🚀 Loading Dream Land...</div>}>
      <RacesContent />
    </Suspense>
  )
}
