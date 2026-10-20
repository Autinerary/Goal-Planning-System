'use client'

import NoPlanYet from '../components/NoPlanYet'
import LifeAreasNote, { useLifeAreasRevealed } from '../components/LifeAreasNote'
import { lifeAreaView, visibleMilestones } from '@/lib/lifeAreas'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loadChosenPathModel, pathModelShortName } from '@/lib/pathModel'
import { Sparkles, ChevronDown, ChevronUp, ExternalLink, ArrowLeft, Users, UserCheck, UserPlus, Bell, Trophy, RefreshCw, Filter, X, Info, AlertTriangle, Send, MessageSquare, Eye, Loader2, Check, Lock, GitCompare } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'
import { useAuth } from '../context/AuthContext'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import { computeRaceProgress } from '@/lib/raceProgress'
import { goHubHref } from '@/lib/serviceHub'
import { usePreferences } from '../context/usePreferences'
import MilestoneTrail from '../components/MilestoneTrail'
import LaneWorld from '../components/LaneWorld'
import DefaultAvatar from '../components/DefaultAvatar'
import UserAvatar from '../components/UserAvatar'
import AnyOrderPond from './AnyOrderPond'
import GoalsTogether, { SharedBadge, sharedFor, useSharedChallenges } from './GoalsTogether'
import GoalsEditor from './GoalsEditor'
import HelpOthersPrompt, { helpPromptOff } from './HelpOthersPrompt'
import MomentCapture from '../components/MomentCapture'
import { socialAvailable } from '@/lib/moments'
import { PeopleOnGoal } from '../hare-world/SameGoals'
import CharacterCar from './CharacterCar'
import { playCarBeep } from '@/lib/taskSound'
import { useMilestoneGuidance } from '@/lib/useMilestoneGuidance'
import { guidanceFor, guidanceSource } from '@/lib/guidanceData'
import { goalAreas, goalsForDimension } from '@/lib/goalCategories'
import { useDisclosure } from '@/lib/disclosure'
import { useCssHeightVar } from '@/lib/useCssHeightVar'
import { GamePanel, GameBanner, GameButton, GameTabs, GameMeter } from '../components/GameUI'

/*
  DREAM LAND — One continuous race-track roadmap.
  Roads are HTML elements IN the document flow (not a background SVG),
  so they always stay connected to the content.
  Pit Stop Shop opens ServiceHub. Milestone sign is a signboard.
*/

const STATS_SHOWN_KEY = 'autinerary_races_stats_shown'
// How many steps were done when Races last saw them, so a step finished on
// another page still gets its "beep beep" here.
const DONE_SEEN_KEY = 'autinerary_races_done_seen'

function RacesContent() {
  const { payload, pathPlanning, toolRecommendation, loading, refresh } = useAgentPath()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { prefs, update: updatePrefs, updateLayout } = usePreferences()
  const { isSimple } = useDisclosure()
  // The race track's progress badge sticks below this header (MilestoneTrail).
  const headerRef = useRef<HTMLElement>(null)
  useCssHeightVar(headerRef, '--page-header-h')
  const [characterAppearance, setCharacterAppearance] = useState<{ hairStyle?: string; hairColor?: string; skinColor?: string; accessory?: string; facialHair?: string; clothing?: string }>({})
  // The areas setup's goals were written under, in this browser (plans made
  // before they were saved with the plan; lib/goalCategories.ts).
  const [setupGoalsByArea, setSetupGoalsByArea] = useState<unknown>(null)
  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem('autinerary_profile') || '{}')
      setCharacterAppearance(local.avatar || {})
      setSetupGoalsByArea(local.goalsByCategory || null)
    } catch {}
  }, [])
  // The character from setup (saved with the account since Group 34; this
  // browser's copy for people who set up before), shown at "You are here".
  // It used to appear nowhere after setup.
  const myCharacter = prefs.character || (characterAppearance.hairStyle ? characterAppearance : null)
  // No character yet: a plain placeholder, not nobody (Riipen Labs, Group 29:
  // "default avatar settings ... if skipped"; components/DefaultAvatar.tsx).
  // On the track they drive a car, which beeps when a step is done (Liam,
  // October 2026); `honk` counts the steps done here.
  const [honk, setHonk] = useState(0)
  const driver = myCharacter ? <UserAvatar {...myCharacter} size={30} /> : <DefaultAvatar size={30} />
  const trailCharacter = <CharacterCar character={driver} honk={honk} />
  // After a milestone is done: two ways to help someone else (HelpOthersPrompt).
  const [helpFor, setHelpFor] = useState<{ id: string; name: string } | null>(null)
  // Before that, "Capture this moment" for the milestone (Hare World Social).
  const [captureFor, setCaptureFor] = useState<{ id: string; name: string } | null>(null)
  // "Your Goals, Dreams & Obstacles", opened from "Add one" under an area.
  const [goalsOpen, setGoalsOpen] = useState(false)
  const goalsPanelRef = useRef<HTMLDivElement>(null)
  const openGoalsPanel = () => {
    setGoalsOpen(true)
    setTimeout(() => goalsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const [isDayTheme, setIsDayTheme] = useState(true)
  const [showRocketEntry, setShowRocketEntry] = useState(false)
  const [rocketPhase, setRocketPhase] = useState<'flying' | 'landing' | 'landed'>('landed')
  const comparisonView = searchParams.get('compare') || null
  // Avoidance and Suggestions; "Compete" ("Learn from others") is gone (the
  // team's notes, October 2026), so an old link to it shows nothing.
  const newView = (['avoidance', 'suggestions'] as const).find((v) => v === searchParams.get('newview')) || null
  const [showPreviousSteps, setShowPreviousSteps] = useState(false)
  const [isWheelSpinning, setIsWheelSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [todaysMotivation, setTodaysMotivation] = useState<string | null>(null)
  const [showCompareMenu, setShowCompareMenu] = useState(false)
  const [showNewViewsMenu, setShowNewViewsMenu] = useState(false)
  const [expandShop, setExpandShop] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')
  const [sentSuggestions, setSentSuggestions] = useState<{ to: string; text: string }[]>([])
  // Hide/Show stats is remembered in this browser; it used to reset every visit.
  const [gamifiedMode, setGamifiedModeState] = useState(true)
  useEffect(() => {
    try { if (localStorage.getItem(STATS_SHOWN_KEY) === '0') setGamifiedModeState(false) } catch {}
  }, [])
  const setGamifiedMode = (shown: boolean) => {
    setGamifiedModeState(shown)
    try { localStorage.setItem(STATS_SHOWN_KEY, shown ? '1' : '0') } catch {}
  }
  const [showPinwheelPopup, setShowPinwheelPopup] = useState(false)
  const [pinwheelHover, setPinwheelHover] = useState(false)
  const [activeDimension, setActiveDimension] = useState('education')
  const [activeDimRace, setActiveDimRace] = useState<string | null>(null)
  const [dimViewMode, setDimViewMode] = useState<'individual' | 'combined'>('individual')
  // "Choose your next path" prompts the user has dismissed (by completed step id).
  const [dismissedBranches, setDismissedBranches] = useState<Set<string>>(new Set())
  const [layoutMode, setLayoutModeState] = useState<'track' | 'list'>('list')
  // Which way the switch slides (Liam: "a transition animation to make it look more smooth").
  const [slideFrom, setSlideFrom] = useState<'left' | 'right'>('right')
  const setLayoutMode = (v: 'track' | 'list') => {
    if (v === layoutMode) return
    setSlideFrom(v === 'list' ? 'right' : 'left')
    setLayoutModeState(v)
  }
  // 'trail' is the level-map view — the whole path as a set of zones you
  // move through, rather than the five-stop road. Default, because seeing
  // progress spatially is the point of the race framing in the first place.
  const [trackShape, setTrackShape] = useState<'trail' | 'pads' | 'one' | 'separate'>('trail')
  // Your generated Dream Self portrait, if you have one. The header showed a
  // generic stick figure even after you had made a portrait of the person you
  // are growing into — which is the one place it most belongs.
  // Name only — the full model, its description and norms live on the Path view.
  const [modelName, setModelName] = useState<string | null>(null)
  useEffect(() => {
    setModelName(pathModelShortName(loadChosenPathModel()))
  }, [])

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
  // Each stat is individually nullable: the API returns null for any stat it
  // has no signal for. A new account with no check-ins gets nulls, not zeros
  // and not a computed-looking number it did nothing to earn.
  type LiveStat = { value: number; change: number | null }
  const [liveStats, setLiveStats] = useState<null | {
    mentality: LiveStat | null
    happiness: LiveStat | null
    focus: LiveStat | null
    energy: LiveStat | null
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
        try {
          const seen = Number(localStorage.getItem(DONE_SEEN_KEY) ?? -1)
          if (seen >= 0 && completed.size > seen) { setHonk((h) => h + 1); playCarBeep() }
          localStorage.setItem(DONE_SEEN_KEY, String(completed.size))
        } catch {}
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
        // A null stat stays null. Coercing it to 0 here was how a user with
        // no data ended up looking scored.
        const pick = (raw: any): LiveStat | null =>
          raw && typeof raw.value === 'number'
            ? { value: raw.value, change: raw.change ?? null }
            : null
        setLiveStats({
          mentality: pick(json.stats.mentality),
          happiness: pick(json.stats.happiness),
          focus:     pick(json.stats.focus),
          energy:    pick(json.stats.energy),
        })
      } catch {
        /* keep fallback */
      }
    })()
    return () => { cancelled = true }
  }, [isSignedIn])

  // Persist hearted goals + completed milestones to localStorage
  useEffect(() => { try { localStorage.setItem('heartedGoals', JSON.stringify([...heartedGoals])) } catch {} }, [heartedGoals])
  useEffect(() => {
    try {
      localStorage.setItem('completedMilestoneIds', JSON.stringify([...completedMilestoneIds]))
      if (isSignedIn) localStorage.setItem(DONE_SEEN_KEY, String(completedMilestoneIds.size))
    } catch {}
  }, [completedMilestoneIds, isSignedIn])
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
  const toggleMilestoneComplete = (id: string, name?: string) => {
    if (!completedMilestoneIds.has(id)) {
      // Beep beep, and the car bounces (CharacterCar).
      playCarBeep()
      setHonk((h) => h + 1)
      // Then "Capture this moment" (Hare World Social), and after it, unless
      // they asked not to: help someone at the same step.
      // (Capturing needs STEP 87; until then, straight to helping.)
      if (name && isSignedIn) socialAvailable().then((on) => (on ? setCaptureFor({ id, name }) : !helpPromptOff() && setHelpFor({ id, name })))
      else if (name && !helpPromptOff()) setHelpFor({ id, name })
    }
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

  // Stats card: prefer the real life-stats loader (Supabase-backed
  // /api/me/life-stats — mentality, happiness, focus, energy computed from
  // reflections + milestones + calendar + check-ins). For guests / pre-load,
  // fall back to a profile-derived approximation so the demo still has bars.
  const stats: { name: string; value: number; max: number; change: number | null }[] = liveStats
    ? ([
        ['Mentality', liveStats.mentality],
        ['Happiness', liveStats.happiness],
        ['Focus',     liveStats.focus],
        ['Activity',  liveStats.energy],
      ] as [string, LiveStat | null][])
        .filter((pair): pair is [string, LiveStat] => pair[1] !== null)
        .map(([name, st]) => ({ name, value: st.value, max: 10, change: st.change }))
    : []
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
    ? []                       // signed in, no recommendations yet, show none
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
  // One life area first (Riipen Labs, Group 20; lib/lifeAreas.ts): until the
  // first milestone is done, the track and lists show the area the plan
  // starts in, and say which come next. Nothing is removed from the plan.
  const allAgentMilestones: any[] = (pathPlanning?.milestones || payload?.milestones || []) as any[]
  const [areasRevealed, revealAreas] = useLifeAreasRevealed()
  const areaView = lifeAreaView(allAgentMilestones, completedMilestoneIds, areasRevealed)
  const agentMilestoneList: any[] = visibleMilestones(allAgentMilestones, areaView)
  const firstMilestoneName: string | undefined = agentMilestoneList[0]?.name || agentMilestoneList[0]?.title
  const raceSources = userGoalNames.length
    ? userGoalNames.map(goal => {
        const matchingRace = payload?.races?.find(race => [race.name, race.goal].some(name => typeof name === 'string' && name.trim().toLowerCase() === goal.trim().toLowerCase()))
        return { ...matchingRace, id: matchingRace?.id || `goal:${goal}`, name: goal }
      })
    : payload?.races || []
  const rawRaces = raceSources.length
    ? raceSources.map((r: any, idx: number) => ({
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
        { emoji: '🛡️', name: 'Norm Shield', cost: '30 coins' },
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

  // The biggest dream (the Dream Self page asks it; setup's answer is kept
  // with the plan too): at the top of the race, above every area's goal.
  const ultimateDream: string = (prefs.biggestDream || payload?.userProfile?.ultimateDream || '').trim()
  // Each goal under its own area only (the team's notes, October 2026:
  // "Graduate university for education ONLY, Get a job for workplace ONLY").
  const goalArea = goalAreas(userGoalNames, payload?.userProfile?.goalCategories, setupGoalsByArea)
  const goalsInDim = (dimKey: string): string[] => goalsForDimension(userGoalNames, goalArea, dimKey)
  const _goalKey = (g: unknown) => String(g ?? '').trim().toLowerCase()
  // Goals added in "Your Goals, Dreams & Obstacles" that have no steps yet.
  const goalsWithoutSteps = userGoalNames.filter((g) => !allAgentMilestones.some((m: any) => _goalKey(m.goal) === _goalKey(g)))
  // Shared challenges (goals with someone): their own colour, and a badge.
  const collabs = useSharedChallenges(isSignedIn)
  const sharedGoal = (goal: string) => sharedFor(goal, collabs)
  // The Avoidance (red) and Suggestions (green) views: at each step, what to
  // avoid or what helps (the team's notes), the same words as the Milestone
  // view's "Top 5 mistakes made at this stage" (lib/guidanceData.ts).
  const notesOn = newView === 'avoidance' || newView === 'suggestions'
  const { guidance, loading: guidanceLoading, failed: guidanceFailed } = useMilestoneGuidance(
    payload as any,
    milestones.map((m: any) => ({ id: m.id, name: m.name })),
    notesOn,
  )
  const stepNotes: Record<string, { tone: 'avoid' | 'tip'; items: string[] }> | undefined = notesOn
    ? Object.fromEntries(
        milestones.flatMap((m: any) => {
          const g = guidanceFor(guidance, m.id, m.name)
          if (!g) return []
          const items = newView === 'avoidance' ? g.avoid : g.tips
          return items.length ? [[m.id, { tone: newView === 'avoidance' ? 'avoid' : 'tip', items }]] : []
        }),
      )
    : undefined
  const notesSource = notesOn ? guidanceFor(guidance, milestones[0]?.id || '', milestones[0]?.name) : null
  // Each list opens at the step you're on: centred in its box, or the finish
  // at the top when all are done. Only the boxes scroll, never the page.
  useEffect(() => {
    const t = setTimeout(() => {
      document.querySelectorAll<HTMLElement>('[data-steps-box]').forEach((box) => {
        const here = box.querySelector<HTMLElement>('[data-current-step]')
        box.scrollTop = here ? Math.max(0, here.offsetTop - box.clientHeight / 2 + here.clientHeight / 2) : 0
      })
    }, 60)
    return () => clearTimeout(t)
  }, [layoutMode, activeDimension, activeDimRace, dimViewMode, completedMilestoneIds.size, milestones.length, notesOn, !!stepNotes])

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
  // Shared dimension metadata — single source of truth for the checklist
  // tabs and the "Separate" parallel-tracks view.
  const dimMeta = [
    { key: 'education',     label: 'Education',          emoji: '🎓', goal: 'Graduate & build a strong foundation', tint: 'from-sky-50 to-white border-sky-200',         tintDark: 'from-sky-900/40 to-indigo-950/60 border-sky-800' , accent: '#7c3aed', node: '#4c1d95', nodeDark: '#2e1065', band: '#e6d9fb', ground: '#cbb6ee' },
    { key: 'workplace',     label: 'Workplace',          emoji: '💼', goal: 'Land a fulfilling, flexible job',      tint: 'from-amber-50 to-white border-amber-200',     tintDark: 'from-amber-900/40 to-indigo-950/60 border-amber-800' , accent: '#d97706', node: '#7c2d12', nodeDark: '#431407', band: '#fbe6c4', ground: '#eecfa0' },
    { key: 'relationships', label: 'Relationships',      emoji: '🤝', goal: 'Build a supportive circle',            tint: 'from-pink-50 to-white border-pink-200',       tintDark: 'from-pink-900/40 to-indigo-950/60 border-pink-800' , accent: '#db2777', node: '#831843', nodeDark: '#500724', band: '#fbd3e3', ground: '#f2b3cd' },
    { key: 'health',        label: 'Health & Lifestyle', emoji: '🌱', goal: 'Feel balanced & energized',           tint: 'from-emerald-50 to-white border-emerald-200', tintDark: 'from-emerald-900/40 to-indigo-950/60 border-emerald-800' , accent: '#059669', node: '#064e3b', nodeDark: '#022c22', band: '#c9eede', ground: '#a3ddc5' },
    // Odosa: the word "barrier" must never appear in the UI. The KEY stays
    // 'barrier' because agent output and stored rows are matched on it.
    { key: 'barrier',       label: 'Norms',              emoji: '🛡️', goal: 'Navigate norms with support',          tint: 'from-violet-50 to-white border-violet-200',   tintDark: 'from-violet-900/40 to-indigo-950/60 border-violet-800', accent: '#7c3aed', node: '#4c1d95', nodeDark: '#2e1065', band: '#e6d9fb', ground: '#cbb6ee' },
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
  const accent = day ? 'from-sky-400 to-indigo-500' : 'from-indigo-600 to-violet-600'
  const line = day ? '#38bdf8' : '#818cf8'
  const stroke = day ? '#0369a1' : '#a78bfa'

  // View gating: List shows the streamlined top + checklist. Track can be a
  // single continuous road ("one") or parallel dimension tracks ("separate").
  const showTrail = layoutMode === 'track' && trackShape === 'trail'
  // Any order (Riipen Labs, Group 34, slide 23): lily pads or clouds.
  const showPads = layoutMode === 'track' && trackShape === 'pads'
  const showContinuousTrack = layoutMode === 'track' && trackShape === 'one'
  const showSeparateTrack = layoutMode === 'track' && trackShape === 'separate'
  // Odosa: Checklist View lives in List View ONLY. Track View gets the race
  // track instead, so the two modes actually differ below the shared top.
  const showChecklist = layoutMode === 'list'

  // ── Race-track stops (Odosa) ────────────────────────────────────────
  // Five dots on the path. The "active" milestone is the one that carries
  // "You are here", and it also decides which grid row the Pit Stop and
  // Current Goals panels sit in, so they flank the path beside it.
  const firstUnfinishedIndex = milestones.findIndex((milestone: any) => !completedMilestoneIds.has(milestone.id))
  const trackStart = Math.max(0, Math.min((firstUnfinishedIndex < 0 ? milestones.length - 1 : firstUnfinishedIndex) - 2, milestones.length - 5))
  const trackStops = milestones.slice(trackStart, trackStart + 5)
  // Where you actually are: the first stop you have NOT finished. This used to
  // read the backend `status` flag, which is always index 0, and "done" was
  // derived from array position rather than from what you had ticked off — so
  // a completed stop further along still rendered as pending.
  const _firstUnfinishedStop = trackStops.findIndex((m: any) => !completedMilestoneIds.has(m.id))
  const currentStopIdx = _firstUnfinishedStop === -1 ? Math.max(trackStops.length - 1, 0) : _firstUnfinishedStop
  // Step 1 at the bottom now: where the current stop sits down the trail, for
  // the panels beside it (MilestoneTrail: PAD_TOP 70, a step every 160px, or
  // 270px with notes), and how many steps come after the last one shown.
  const stepsAhead = Math.max(0, milestones.length - (trackStart + trackStops.length))
  const activeStopY = 40 + 70 + (stepsAhead > 0 ? 24 : 0) + (trackStops.length - 1 - currentStopIdx) * (stepNotes ? 270 : 160)

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
    @keyframes raceSlideRight{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:translateX(0)}}
    @keyframes raceSlideLeft{from{opacity:0;transform:translateX(-48px)}to{opacity:1;transform:translateX(0)}}
    .race-slide-right{animation:raceSlideRight .38s cubic-bezier(.22,.8,.3,1)}
    .race-slide-left{animation:raceSlideLeft .38s cubic-bezier(.22,.8,.3,1)}
    @media(prefers-reduced-motion:reduce){.race-slide-right,.race-slide-left,.bn,.dg,.cf,.st,.sw,.aw{animation:none}}
    html[data-reduce-motion="on"] .race-slide-right,html[data-reduce-motion="on"] .race-slide-left{animation:none}
  `

  /* Storefront navigation row — Toolbox · ResourceHub · Hare World · Tidbits */
  const StorefrontRow = () => {
    const hub = goHubHref('/')
    const shops: { emoji: string; name: string; desc: string; href: string; ext: boolean }[] = [
      { emoji: '🧰', name: 'Toolbox',     desc: 'Quick tools & utilities',   href: '/tools',                                ext: false },
      { emoji: '🏪', name: 'ResourceHub', desc: 'Find relevant resources', href: hub,                                     ext: true  },
      { emoji: '🐰', name: 'Hare World',  desc: 'Role models & mentors',      href: '/hare-world',   ext: false },
      { emoji: '💬', name: 'Tidbits',     desc: 'View Related posts',         href: goHubHref('/community?from=hare-world&context=races'), ext: true  },
    ]
    return (
      <div className="w-full max-w-3xl px-2 my-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {shops.map(s => {
            const inner = (
              <>
                <div className="text-2xl mb-1">{s.emoji}</div>
                <div className={`font-bold text-xs ${txt}`}>{s.name}</div>
                <div className={`text-[0.5625rem] ${sub} mb-2 leading-snug`}>{s.desc}</div>
                <div className={`text-[0.625rem] font-bold px-2 py-1 rounded-lg shadow bg-gradient-to-r ${accent} text-white`}>Go to {s.name} →</div>
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
      <div className={`relative ${trackCol} rounded-lg`} style={{ width: 52, height: h }}>
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
    return <NoPlanYet what="Each goal becomes a race here, made of small steps," />
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
      {/* A painted ground rather than a flat wash — the game panels sat on a
          plain gradient and read as pasted on. Layered radial washes give the
          page depth to sit against, and the rolling hills at the foot give it
          a horizon. Still pure CSS/SVG, so it costs nothing to load. */}
      <div
        className={`min-h-screen ${day ? '' : 'bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950'} relative overflow-x-clip transition-colors duration-700`}
        style={
          day
            ? {
                backgroundImage: [
                  'radial-gradient(1200px 420px at 12% -8%, rgba(255,236,190,.85), transparent 70%)',
                  'radial-gradient(900px 380px at 88% 4%, rgba(190,226,255,.85), transparent 70%)',
                  'radial-gradient(1000px 500px at 50% 100%, rgba(198,240,214,.75), transparent 70%)',
                  'linear-gradient(180deg,#bfe3ff 0%,#ddf0ff 42%,#fdf3dd 100%)',
                ].join(','),
              }
            : undefined
        }
      >
        <style>{css}</style>

        {/* Rolling hills, fixed to the bottom — gives the page a horizon so the
            panels read as standing in a place rather than floating on a fill. */}
        {day && (
          <svg
            className="fixed bottom-0 left-0 w-full h-[38vh] pointer-events-none z-0"
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,28 C18,20 30,32 46,26 C62,20 76,30 100,23 L100,40 L0,40 Z" fill="rgba(134,205,161,.35)" />
            <path d="M0,33 C22,26 38,36 56,31 C74,26 86,35 100,30 L100,40 L0,40 Z" fill="rgba(106,186,140,.40)" />
          </svg>
        )}

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
        <header ref={headerRef} style={{ top: 'var(--nav-h, 0px)' }} className={`sticky z-40 ${day ? 'bg-sky-100/90' : 'bg-indigo-950/90'} backdrop-blur-md border-b ${day ? 'border-sky-200' : 'border-indigo-800'} px-4 py-2`}>
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
              }} aria-label="Back" className={`p-1 rounded-lg hover:bg-black/10 ${txt}`}><ArrowLeft className="w-5 h-5" aria-hidden="true" /></button>
              <h1 className={`text-lg font-bold flex items-center gap-2 ${txt}`}><span aria-hidden="true">🏁</span>Races</h1>
              {modelName && (
                <Link
                  href="/path#life-path-models"
                  title="View this Life Path Model"
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    day
                      ? 'bg-white/70 border-sky-300 text-sky-800 hover:bg-white'
                      : 'bg-indigo-900/70 border-indigo-700 text-indigo-100 hover:bg-indigo-900'
                  }`}
                >
                  {modelName}
                </Link>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Motivation Pinwheel - position follows the user's saved layout preference */}
              <div className="relative pref-widget" style={{ order: prefs.layout.pinwheelSide === 'right' ? 99 : -1 }}>
                <button
                  onClick={() => setShowPinwheelPopup(true)}
                  aria-label="Open the motivation pinwheel"
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
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[0.625rem] px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
                    Motivation Pinwheel
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setIsDayTheme(!isDayTheme)} aria-pressed={!day} aria-label={day ? 'Night colours' : 'Day colours'} title={day ? 'Night colours' : 'Day colours'} className={`px-2 py-1 rounded-lg text-xs font-semibold shadow ${day ? 'bg-indigo-600 text-white' : 'bg-amber-400 text-slate-900'}`}><span aria-hidden="true">{day ? '🌙' : '☀️'}</span></button>
              <div className="relative">
                <button onClick={() => { setShowCompareMenu(!showCompareMenu); setShowNewViewsMenu(false) }} className={`px-2 py-1 bg-gradient-to-r ${accent} text-white rounded-lg text-xs font-semibold`}><RefreshCw className="w-3 h-3 inline mr-1" />Compare</button>
                {showCompareMenu && <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border z-50 min-w-[190px] p-1.5">{[{ k: 'rolemodel', l: 'With role models', I: Users }, { k: 'friend', l: 'With friends', I: UserPlus }, { k: 'mentor', l: 'With mentors', I: UserCheck }].map(x => (<button key={x.k} onClick={() => { router.push(`/races?compare=${x.k}`); setShowCompareMenu(false) }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded text-sm text-slate-700"><x.I className="w-4 h-4" />{x.l}</button>))}</div>}
              </div>
              <div className="relative">
                <button onClick={() => { setShowNewViewsMenu(!showNewViewsMenu); setShowCompareMenu(false) }} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold"><Filter className="w-3 h-3 inline mr-1" />Views</button>
                {showNewViewsMenu && <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border z-50 min-w-[160px] p-1.5">{[{ k: 'avoidance', l: '① Avoidance' }, { k: 'suggestions', l: '② Suggestions' }].map(v => (<button key={v.k} onClick={() => { router.push(`/races?newview=${v.k}`); setShowNewViewsMenu(false) }} className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm text-slate-700">{v.l}</button>))}</div>}
              </div>
            </div>
          </div>
        </header>

        <LifeAreasNote view={areaView} onReveal={revealAreas} className="mx-auto mt-3 max-w-5xl" />

        {/* Asked where it is used (Riipen Labs, Group 30: "move deferred
            questions into contextual prompts shown when related features are
            first used"): the character stands on this track. */}
        {!myCharacter && milestones.length > 0 && (
          <p className={`mx-auto mt-2 max-w-5xl px-4 text-sm ${day ? 'text-slate-800' : 'text-indigo-100'}`}>
            On the track you are a placeholder for now.{' '}
            <Link href="/ideal-self" className="font-semibold underline underline-offset-2">Design your character</Link>
          </p>
        )}

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
              <div className={`${day ? 'bg-white/90 border-slate-200' : 'bg-indigo-950/90 border-indigo-800'} border-2 rounded-2xl p-6 shadow-xl`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Eye className={`w-4 h-4 ${sub}`} />
                    <span className={`text-sm font-bold ${txt}`}>Compare with a {cat.label}</span>
                  </div>
                  <button onClick={() => router.push('/races')} aria-label="Close" className={`p-1.5 rounded-lg hover:bg-black/10 ${day ? 'bg-slate-100' : 'bg-indigo-900'} ${txt}`}><X className="w-5 h-5" aria-hidden="true" /></button>
                </div>

                {people.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">👥</div>
                    <p className={`text-sm mb-4 ${sub}`}>You haven&apos;t connected with a {cat.label.toLowerCase()} yet. Comparisons use your real connections&apos; shared paths.</p>
                    <Link href="/hare-world" className="inline-block px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold hover:shadow-lg transition-all">
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
                    {unlinked.map((p: any) => p.name).join(', ')} {unlinked.length === 1 ? 'is' : 'are'} saved as {unlinked.length === 1 ? 'a contact' : 'contacts'} without a linked account, comparisons need a connected app user.
                  </p>
                )}
              </div>
            </div>
          )
        })()}

        {/* ═══ AVOIDANCE / SUGGESTIONS ═══ At each step, in red what to avoid
            or in green what helps (the team's notes, October 2026), rather
            than one general list at the top. This says where to look. */}
        {newView && (
          <div className="relative z-30 max-w-3xl mx-auto px-4 pt-3">
            <div
              className={`border-2 rounded-2xl p-4 ${newView === 'avoidance'
                ? (day ? 'border-red-300 bg-red-50' : 'border-red-700 bg-red-950/70')
                : (day ? 'border-green-300 bg-green-50' : 'border-green-700 bg-green-950/70')}`}
              data-notes-view={newView}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className={`text-base font-bold ${newView === 'avoidance' ? (day ? 'text-red-900' : 'text-red-100') : (day ? 'text-green-900' : 'text-green-100')}`}>
                  {newView === 'avoidance' ? 'Avoidance: what to avoid at each step' : 'Suggestions: what helps at each step'}
                </h2>
                <button onClick={() => router.push('/races')} aria-label="Close" className={`${sub} rounded-lg p-1 hover:bg-black/10`}><X className="w-5 h-5" aria-hidden="true" /></button>
              </div>
              <p className={`mt-1 text-sm ${day ? 'text-slate-800' : 'text-slate-100'}`}>
                {guidanceLoading
                  ? 'Writing it for each of your steps now…'
                  : guidanceFailed
                    ? 'This couldn’t load right now. Try again later.'
                    : `Each step below shows it in ${newView === 'avoidance' ? 'red' : 'green'}.`}
                {layoutMode === 'track' && (trackShape === 'pads' || trackShape === 'separate') && ' Switch to Trail Map, As One or List View to see it.'}
              </p>
              {notesSource && <p className={`mt-1 text-xs ${day ? 'text-slate-700' : 'text-slate-300'}`}>{guidanceSource(notesSource)}</p>}
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

          {/* ═══ YOUR GOALS, DREAMS & OBSTACLES ═══
              Surfaced at the top so users can see their choices ARE being
              considered (Odosa), and changed right here without setting up
              again (the team's notes, October 2026; GoalsEditor). */}
          {(userGoalNames.length > 0 || ((payload?.userProfile?.dreams || []) as string[]).length > 0) && (
            <div className="w-full max-w-2xl px-2 pt-4" ref={goalsPanelRef}>
              {/* Folded: what the races were made from is background, and
                  Races was crowded with it (Riipen Labs, Group 32). */}
              <details className={`${pill} border rounded-2xl p-4 shadow-sm`} open={goalsOpen} onToggle={(e) => setGoalsOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="flex cursor-pointer items-center gap-2">
                  <Sparkles className={`w-4 h-4 ${day ? 'text-purple-600' : 'text-purple-300'}`} aria-hidden="true" />
                  <h3 className={`font-bold text-sm ${txt}`}>Your Goals, Dreams &amp; Obstacles</h3>
                  <span className={`text-[0.625rem] ${sub} ml-auto`}>What your races were made from. You can change them here.</span>
                </summary>
                <GoalsEditor
                  day={day}
                  goals={userGoalNames}
                  areas={goalArea}
                  dreams={(payload?.userProfile?.dreams || []) as string[]}
                  obstacles={(payload?.userProfile?.currentChallenges || []) as string[]}
                  ultimateDream={ultimateDream}
                  progressFor={(goal) => computeRaceProgress(rawRaces.find((r: any) => r.name === goal) || { name: goal }, milestones, completedMilestoneIds)}
                  goalsWithoutSteps={goalsWithoutSteps}
                  sharedFor={sharedGoal}
                  onSaved={refresh}
                  onUltimateDream={(text) => { updatePrefs({ biggestDream: text }) }}
                />
              </details>
            </div>
          )}

          {/* ═══════════════════
              TRACK / LIST toggle — centered, below the main nav
             ═══════════════════ */}
          <div className="pt-4 w-full flex justify-center" data-tour="races-view">
            <GameTabs
              value={layoutMode}
              onChange={(v) => setLayoutMode(v)}
              options={[
                { id: 'track' as const, label: 'Track View', icon: '🏁' },
                { id: 'list' as const, label: 'List View', icon: '📋' },
              ]}
            />
          </div>

          {isSignedIn && <GoalsTogether day={day} collabs={collabs} />}

          {/* Everything below changes with the view: it slides in from the
              side of the tab chosen (Liam: "a transition animation to make
              it look more smooth"). Still for anyone who asked for less motion. */}
          <div key={layoutMode} className={`w-full flex flex-col items-center ${slideFrom === 'right' ? 'race-slide-right' : 'race-slide-left'}`} data-race-view={layoutMode}>

          {/* Track shape sub-toggle. Trail Map and Any order for everyone;
              As One and Separate once the app shows more (useDisclosure). */}
          {layoutMode === 'track' && (
            <div className="pt-2 w-full flex justify-center">
              <GameTabs
                value={trackShape}
                onChange={(v) => setTrackShape(v)}
                options={[
                  { id: 'trail' as const, label: 'Trail Map', icon: '🗺️' },
                  { id: 'pads' as const, label: 'Any order', icon: '🪷' },
                  ...(isSimple ? [] : [
                    { id: 'one' as const, label: 'As One', icon: '🛣️' },
                    { id: 'separate' as const, label: 'Separate', icon: '🏁' },
                  ]),
                ]}
              />
            </div>
          )}

          {layoutMode === 'track' && milestones.length > 0 && (() => {
            const done = milestones.filter((m: any) => completedMilestoneIds.has(m.id)).length
            const pct = Math.round((done / milestones.length) * 100)
            const real = rawRaces.filter((r: any) => r.id !== 'r_placeholder')
            return (
              <div className="w-full max-w-2xl px-2 pt-4" data-track-progress>
                <div className={`${pill} border rounded-2xl p-4 shadow-sm`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[0.75rem] font-bold ${txt}`}>All steps progress</span>
                    <span className={`text-[0.75rem] font-bold ${txt}`}>{done}/{milestones.length} · {pct}%</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${day ? 'bg-slate-200' : 'bg-indigo-900'}`}>
                    <div className="h-full bg-gradient-to-r from-sky-400 to-purple-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {real.length > 1 && (
                    <ul className="mt-3 space-y-2">
                      {real.map((r: any) => (
                        <li key={r.id}>
                          <div className={`flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] font-semibold ${txt}`}>
                            <span className="flex flex-wrap items-center gap-1.5">{r.name}{sharedGoal(r.name) && <SharedBadge collab={sharedGoal(r.name)!} small />}{isSignedIn && <PeopleOnGoal goal={r.name} />}</span>
                            <span>{r.progress}%</span>
                          </div>
                          <div className={`mt-0.5 h-1.5 rounded-full overflow-hidden ${day ? 'bg-slate-200' : 'bg-indigo-900'}`}>
                            <div className="h-full bg-gradient-to-r from-sky-400 to-purple-400 rounded-full transition-all" style={{ width: `${r.progress}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })()}

          {/* ═══════════════════
              SHARED TOP (1 of 2) — Stats + ResourceHub + Hare World.
              Odosa: "the track view AND list view should BOTH have the Stats
              and ResourceHub & Hare World options that only the list view
              currently has." Ungated, and first in the order for both views.
             ═══════════════════ */}
            <div className="w-full max-w-2xl px-2 pt-4 space-y-3">
              {/* Stats (moved to the top) */}
              {gamifiedMode ? (
                <GamePanel tone="parchment" className="px-4 pt-6 pb-4">
                  <GameBanner tone="violet">✨ Your Stats</GameBanner>
                  {!liveStats && <p className="py-3 text-center text-sm text-slate-600">Live stats are not available yet.</p>}
                  {liveStats && stats.length === 0 && (
                    <p className="py-3 text-center text-sm text-slate-600">
                      No stats yet. Check in with your mood or tick off a milestone and they&apos;ll start filling in.
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {stats.map((st, i) => (
                      <GameMeter
                        key={i}
                        label={st.name}
                        value={st.value}
                        max={st.max}
                        tone={
                          ['linear-gradient(180deg,#a78bfa,#7c3aed)',
                           'linear-gradient(180deg,#fbbf24,#f59e0b)',
                           'linear-gradient(180deg,#38bdf8,#0284c7)',
                           'linear-gradient(180deg,#34d399,#059669)'][i % 4]
                        }
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <GameButton size="sm" tone="slate" onClick={() => setGamifiedMode(false)}>Hide</GameButton>
                    <GameButton size="sm" tone="emerald" href="/stats">Full breakdown →</GameButton>
                  </div>
                </GamePanel>
              ) : (
                <div className="flex justify-center">
                  <GameButton size="sm" tone="slate" onClick={() => setGamifiedMode(true)}>✨ Show stats</GameButton>
                </div>
              )}

              {/* ResourceHub + Hare World (moved up). The simple view leaves them
                  out: both are Quick Links on the Path, and Find resources is in
                  the top bar (Group 32). */}
              {!isSimple && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <GamePanel tone="parchment" className="px-4 pt-6 pb-4 flex flex-col">
                  <GameBanner tone="amber">🏪 ResourceHub</GameBanner>
                  <p className="text-[0.6875rem] font-medium text-amber-900/80 mb-3 flex-1 text-center">
                    Curated tools, services &amp; support matched to the barriers you face and your goals.
                  </p>
                  <GameButton tone="amber" size="sm" href={goHubHref('/')} className="w-full">
                    Open ResourceHub →
                  </GameButton>
                </GamePanel>

                <GamePanel tone="rose" className="px-4 pt-6 pb-4 flex flex-col">
                  <GameBanner tone="violet">🐰 Hare World</GameBanner>
                  <p className="text-[0.6875rem] font-medium text-rose-900/80 mb-3 flex-1 text-center">
                    Your role models, mentors &amp; people. See how they&apos;re getting on and learn from them.
                  </p>
                  <GameButton tone="violet" size="sm" href="/hare-world" className="w-full">
                    Open Hare World →
                  </GameButton>
                </GamePanel>
              </div>
              )}
            </div>

          {/* ═══════════════════
              SHARED TOP (2 of 2) — Dream Self, hovering figure through
              "See your Dream Self" ONLY. Odosa: both views get this, second.
              The Stats / goals grid / "Add another goal" / "Today's
              Motivation" that used to sit under it in Track View are
              deleted — the block above already covers stats, and the race
              track below covers the goal. Anything view-specific comes
              AFTER this point.
             ═══════════════════ */}
          <div className="pt-8 flex flex-col items-center" data-dream-self>
            <div className="relative dg rounded-full p-4 mb-1">
              <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-28 h-8 rounded-full blur-lg ${day ? 'bg-white/60' : 'bg-indigo-300/15'}`} />
              <div className="bn relative">
                {/* The Dream Self as made in the Dream Self section (Odosa,
                    October 2026: "just keep this the 'Dream Self' from the
                    'Dream Self' section"); the car is for "You are here". */}
                <span className="block" role="img" aria-label={prefs.dreamAppearance ? 'Your Dream Self' : 'Your Dream Self, not designed yet'}>
                  {prefs.dreamAppearance ? <UserAvatar {...prefs.dreamAppearance} size={104} /> : <DefaultAvatar size={104} />}
                </span>
              </div>
            </div>
            <div className={`text-lg font-bold ${day ? 'text-indigo-700' : 'text-indigo-200'}`}>Dream Self</div>
            {/* The biggest dream at the top of the race (the team's notes):
                each area's goal is under its own area below. */}
            <div className={`max-w-md text-center text-sm font-medium ${day ? 'text-slate-800' : 'text-indigo-100'} mb-1`}>{ultimateDream || 'Cloud 9: Your ideal future'}</div>
            <Link href="/ideal-self" className={`inline-block py-1 text-xs font-bold ${day ? 'text-purple-700' : 'text-purple-300'} underline underline-offset-2`}>
              See your Dream Self
            </Link>
            {/* Path view already surfaces the multi-path switcher; Races did
                not (Odosa asked for it at the top of Path and/or Race view). */}
            <Link
              href="/paths/compare"
              className={`py-1 text-xs font-semibold flex items-center gap-1 ${day ? 'text-slate-600 hover:text-slate-800' : 'text-slate-300 hover:text-slate-100'}`}
            >
              <GitCompare className="w-3 h-3" /> Compare / switch paths
            </Link>
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
              dimSubRaces.barrier = [{ id: 'barrier-main', name: 'Norms Support', steps: barrierSteps }]
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
                <div className={`text-center mb-4 text-[0.625rem] ${sub}`}>
                  One dimension at a time · Switch between races
                </div>

                {/* Individual | Combined toggle — always available */}
                <div className="flex justify-center mb-4">
                  <div className={`inline-flex rounded-lg border overflow-hidden text-[0.625rem] font-bold ${day ? 'border-slate-200' : 'border-indigo-700'}`}>
                    <button onClick={() => setDimViewMode('individual')} className={`px-3 py-1 ${dimViewMode === 'individual' ? (day ? 'bg-white text-slate-800' : 'bg-indigo-700 text-white') : (day ? 'bg-slate-50 text-slate-600' : 'bg-indigo-950 text-indigo-300')}`}>Individual</button>
                    <button onClick={() => setDimViewMode('combined')} className={`px-3 py-1 ${dimViewMode === 'combined' ? (day ? 'bg-white text-slate-800' : 'bg-indigo-700 text-white') : (day ? 'bg-slate-50 text-slate-600' : 'bg-indigo-950 text-indigo-300')}`}>Combined</button>
                  </div>
                </div>

                {dimViewMode === 'combined' ? (
                  /* ══ COMBINED — four life dimensions, one goal ══ */
                  <div className="w-full">
                    <div className={`text-center mb-3 text-[0.6875rem] font-bold ${txt}`}>🏠 Four life dimensions, one goal</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
                      {dimOrder.filter(d => d.key !== 'barrier').map(dim => {
                        const lanes = dimSubRaces[dim.key] || []
                        const laneSteps = lanes[0]?.steps || []
                        return (
                          <div key={dim.key} className={`rounded-2xl border bg-gradient-to-b ${day ? dim.tint : dim.tintDark} p-3 shadow-sm`}>
                            <div className={`flex items-center gap-1.5 font-bold text-[0.6875rem] mb-1 ${txt}`}>
                              <span className="text-base">{dim.emoji}</span>
                              <span className="uppercase tracking-wider">{dim.label}</span>
                            </div>
                            {userBarrierLabels.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {userBarrierLabels.slice(0, 3).map(b => (<span key={b} className={`text-[0.4375rem] px-1 py-0.5 rounded-full border ${day ? 'bg-white/70 text-slate-600 border-slate-200' : 'bg-indigo-900/60 text-indigo-300 border-indigo-700'}`}>{b}</span>))}
                              </div>
                            )}
                            <div className={`text-[0.5625rem] font-bold mb-2 ${txt}`}>
                              🎯 {goalsInDim(dim.key).length ? goalsInDim(dim.key).join(' · ') : <span className="font-medium">No {dim.label} goal yet</span>}
                              {goalsInDim(dim.key).map((g) => sharedGoal(g)).filter(Boolean).slice(0, 1).map((c) => <span key={c!.id} className="ml-1"><SharedBadge collab={c!} small /></span>)}
                            </div>
                            {/* Step 1 at the bottom, the last at the top, opened at the step you're on. */}
                            <div className="max-h-72 overflow-y-auto pr-1" data-steps-box>
                            <div className="relative pl-4">
                              <div className={`absolute left-1.5 top-1 bottom-1 w-[2px] ${day ? 'bg-slate-300' : 'bg-indigo-700'}`} />
                              {(() => {
                                const here = laneSteps.findIndex((st) => !completedMilestoneIds.has(st.id))
                                return laneSteps.map((step, i) => ({ step, i })).reverse().map(({ step, i }) => {
                                const isCompleted = completedMilestoneIds.has(step.id)
                                const isHere = i === here
                                const note = stepNotes?.[step.id]
                                return (
                                  <div key={step.id} data-current-step={isHere || undefined} className={`relative mb-1.5 p-1.5 rounded-lg border ${isCompleted ? (day ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-900/30 border-emerald-700') : isHere ? (day ? 'bg-amber-50 border-amber-400' : 'bg-amber-900/50 border-amber-600') : (day ? 'bg-white border-slate-200' : 'bg-indigo-950/40 border-indigo-700')}`}>
                                    <span className={`absolute -left-[13px] top-2 w-3 h-3 rounded-full ring-2 ${day ? 'ring-white' : 'ring-slate-900'} ${isCompleted ? 'bg-emerald-500' : isHere ? 'bg-gradient-to-br from-amber-400 to-orange-500' : (day ? 'bg-sky-400' : 'bg-sky-600')}`} />
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <span className="text-[0.5rem]">{isCompleted ? '✅' : isHere ? '📍' : '🪧'}</span>
                                      <span className={`text-[0.5rem] font-mono ${sub}`}>Step {i + 1}</span>
                                      {isHere && <span className={`text-[0.5rem] font-bold ml-auto ${day ? 'text-amber-800' : 'text-amber-300'}`}>HERE</span>}
                                    </div>
                                    <div className={`text-[0.5625rem] font-bold leading-snug ${isCompleted ? 'line-through opacity-60' : ''} ${txt}`}>{step.name}</div>
                                    {note && (
                                      <ul className={`mt-1 space-y-0.5 text-[0.5625rem] font-medium ${note.tone === 'avoid' ? (day ? 'text-red-700' : 'text-red-300') : (day ? 'text-green-800' : 'text-green-300')}`} data-step-notes={note.tone}>
                                        {note.items.slice(0, 3).map((item) => <li key={item}>{note.tone === 'avoid' ? '✕' : '✓'} {item}</li>)}
                                      </ul>
                                    )}
                                  </div>
                                )
                              })
                              })()}
                            </div>
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
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.6875rem] font-bold transition-all border ${activeDimension === dim.key
                        ? `${day ? 'bg-white shadow-md border-slate-300 text-slate-800' : 'bg-indigo-800 shadow-md border-indigo-500 text-white'} scale-105`
                        : `${day ? 'bg-white/60 border-slate-200 text-slate-500 hover:bg-white/80' : 'bg-indigo-950/40 border-indigo-700 text-indigo-400 hover:bg-indigo-900/60'}`
                      }`}
                    >
                      <span aria-hidden="true">{dim.emoji}</span>
                      {/* Named on a phone too: there it was the emoji alone,
                          for screen readers as well (Riipen Labs, Group 33). */}
                      <span>{dim.label}</span>
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
                      <span key={b} className={`inline-flex items-center gap-1 text-[0.5rem] px-1.5 py-0.5 rounded-full ${day ? 'bg-white/70 text-slate-600' : 'bg-indigo-900/60 text-indigo-300'} border ${day ? 'border-slate-200' : 'border-indigo-700'}`}>
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
                          placeholder="Add norm…"
                          className={`text-[0.5rem] px-1.5 py-0.5 rounded-full border w-24 focus:outline-none ${day ? 'bg-white border-slate-300 text-slate-700' : 'bg-indigo-950 border-indigo-600 text-indigo-200'}`}
                        />
                        <button
                          onClick={() => {
                            const v = newBarrierText.trim()
                            if (v && !userBarrierLabels.includes(v)) setExtraBarriers(prev => [...prev, v])
                            setNewBarrierText(''); setAddingBarrier(false)
                          }}
                          className={`text-[0.5rem] font-bold ${day ? 'text-cyan-600' : 'text-cyan-300'}`}
                        >
                          Add
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setAddingBarrier(true)}
                        className={`text-[0.5rem] px-1.5 py-0.5 rounded-full border border-dashed font-bold ${day ? 'border-slate-300 text-slate-500 hover:bg-white/70' : 'border-indigo-600 text-indigo-300 hover:bg-indigo-900/40'}`}
                        title="Add a norm or condition to consider here"
                      >
                        + Add
                      </button>
                    )}
                  </div>

                  {/* This area's own goals, and only them (the team's notes:
                      "Graduate university for education ONLY"). */}
                  <div className={`mb-3 px-2.5 py-2 rounded-lg border ${day ? 'bg-white/70 border-slate-200' : 'bg-indigo-950/40 border-indigo-700'}`} data-area-goals={activeDim.key}>
                    <div className={`text-[0.5625rem] font-bold uppercase tracking-wider ${sub}`}>🎯 {goalsInDim(activeDim.key).length > 1 ? 'Goals' : 'Goal'}</div>
                    {goalsInDim(activeDim.key).length ? goalsInDim(activeDim.key).map((g) => (
                      <div key={g} className={`flex flex-wrap items-center gap-1.5 text-[0.75rem] font-bold leading-snug ${txt}`}>
                        <span>{g}</span>
                        {sharedGoal(g) && <SharedBadge collab={sharedGoal(g)!} small />}
                        {/* Your people on a goal like this one ("Person's Icon @ Goal"). */}
                        {isSignedIn && <PeopleOnGoal goal={g} />}
                      </div>
                    )) : (
                      <div className={`text-[0.75rem] ${txt}`}>
                        No {activeDim.label} goal yet.{' '}
                        <button type="button" onClick={openGoalsPanel} className={`font-semibold underline underline-offset-2 ${day ? 'text-sky-800' : 'text-sky-200'}`}>Add one</button>
                      </div>
                    )}
                  </div>

                  {/* Sub-race tabs (only in individual mode, only if > 1 race) */}
                  {dimViewMode === 'individual' && subRaces.length > 1 && (
                    <div className="flex gap-1.5 mb-3">
                      {subRaces.map(sr => (
                        <button
                          key={sr.id}
                          onClick={() => setActiveDimRace(sr.id)}
                          className={`flex-1 px-2 py-1.5 rounded-lg text-[0.625rem] font-bold transition-all border ${sharedGoal(sr.name) ? 'border-teal-500 ring-1 ring-teal-500' : ''} ${(activeDimRace === sr.id || (!activeDimRace && sr.id === subRaces[0].id))
                            ? `${day ? 'bg-white border-slate-300 shadow-sm text-slate-800' : 'bg-indigo-800 border-indigo-500 text-white'}`
                            : `${day ? 'bg-white/60 border-slate-200 text-slate-700' : 'bg-indigo-950/30 border-indigo-700 text-indigo-200'}`
                          }`}
                        >
                          {sr.name}
                          {sharedGoal(sr.name) && <span className="mt-0.5 block"><SharedBadge collab={sharedGoal(sr.name)!} small /></span>}
                          <span className={`ml-1 text-[0.5rem] ${day ? 'text-slate-400' : 'text-indigo-500'}`}>{sr.steps.length} steps</span>
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
                    <div className={`rounded-xl border-2 border-dashed p-6 text-center ${day ? 'border-slate-300 bg-white/50' : 'border-indigo-700 bg-indigo-950/30'}`}>
                      <div className="text-2xl mb-1">🗺️</div>
                      <div className={`text-xs font-bold ${txt}`}>No steps here yet</div>
                      <p className={`text-[0.625rem] mt-1 ${sub}`}>
                        Your plan hasn&apos;t produced any {activeDim.label} steps yet. Add a goal in
                        this area and the agents will build the path.
                      </p>
                      <button
                        onClick={() => router.push('/onboarding?step=3')}
                        className={`mt-3 text-[0.625rem] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r ${accent} text-white shadow hover:scale-105 transition-all`}
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
                          <span className={`text-[0.625rem] font-bold ${txt}`}>
                            {activeSubRace ? activeSubRace.name : 'All steps'} progress
                          </span>
                          <span className={`text-[0.625rem] font-bold ${txt}`}>
                            {doneCount}/{shown.length} · {pct}%
                          </span>
                        </div>
                        <div className={`h-2 rounded-full overflow-hidden ${day ? 'bg-slate-200' : 'bg-indigo-900'}`}>
                          <div className="h-full bg-gradient-to-r from-sky-400 to-purple-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Steps list: step 1 at the bottom and the last at the top,
                      opened at the step you're on (the team's notes, October
                      2026: "Flip the order ... Then, center it at the current
                      step for each race"). */}
                  <div className="max-h-[30rem] overflow-y-auto pr-1" data-steps-box>
                  <div className="relative pl-4">
                    {/* Lane road line */}
                    <div className={`absolute left-2 top-2 bottom-2 w-[2px] ${day ? 'bg-slate-300' : 'bg-indigo-700'}`} />

                    {(() => {
                      const arr = activeSubRace ? activeSubRace.steps : combinedSteps
                      // Where you are: the first step not done (not the plan's own flag, always step 1).
                      const here = arr.findIndex((st) => !completedMilestoneIds.has(st.id))
                      return arr.map((step, i) => ({ step, i })).reverse().map(({ step, i }) => {
                      const isCompleted = completedMilestoneIds.has(step.id)
                      const isHearted = heartedGoals.has(step.id)
                      const isHere = i === here
                      const note = stepNotes?.[step.id]
                      // After a completed milestone, check if we should show branching
                      const justCompletedMilestone = isCompleted && i < arr.length - 1 && !completedMilestoneIds.has(arr[i + 1].id)

                      return (
                        <div key={step.id}>
                          {/* ── Branching: 3 options after a completed milestone,
                              between it and the next step (above it now) ── */}
                          {justCompletedMilestone && !dismissedBranches.has(step.id) && (
                            <div className={`ml-2 mb-3 p-3 rounded-xl border ${day ? 'bg-purple-50/80 border-purple-200' : 'bg-purple-900/20 border-purple-700'}`}>
                              <div className={`text-[0.625rem] font-bold mb-2 ${txt}`}>🔀 Choose your next path:</div>
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
                                        router.push(arr[i + 1]?.id ? `/milestones?m=${encodeURIComponent(arr[i + 1].id)}` : '/milestones')
                                      } else {
                                        // Continue on current path: acknowledge & dismiss.
                                        setDismissedBranches(prev => new Set(prev).add(step.id))
                                      }
                                    }}
                                    className={`w-full flex items-start gap-2 p-2 rounded-lg border text-left transition-all hover:shadow-sm hover:scale-[1.01] ${day ? 'bg-white border-slate-200 hover:border-purple-300' : 'bg-indigo-950/40 border-indigo-700 hover:border-purple-500'}`}
                                  >
                                    <span className="text-sm mt-0.5">{opt.icon}</span>
                                    <div>
                                      <div className={`text-[0.625rem] font-bold ${txt}`}>{opt.label}</div>
                                      <div className={`text-[0.5625rem] ${sub}`}>{opt.desc}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div
                            data-current-step={isHere || undefined}
                            className={`relative w-full text-left mb-2 p-2.5 rounded-lg border transition-all ${
                              isCompleted
                                ? `${day ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-900/30 border-emerald-700'}`
                                : isHere
                                  ? `${day ? 'bg-amber-50 border-amber-400' : 'bg-amber-900/50 border-amber-600'} shadow-sm`
                                  : `${day ? 'bg-white border-slate-200' : 'bg-indigo-950/40 border-indigo-700'}`
                            }`}
                          >
                            {/* Node dot */}
                            <span className={`absolute -left-[18px] top-3.5 w-3.5 h-3.5 rounded-full ring-2 ${day ? 'ring-white' : 'ring-slate-900'} ${
                              isCompleted ? 'bg-emerald-500' : isHere ? 'bg-gradient-to-br from-amber-400 to-orange-500' : (day ? 'bg-sky-400' : 'bg-sky-600')
                            }`} />

                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="text-[0.625rem]">{isCompleted ? '✅' : isHere ? '📍' : '🪧'}</span>
                                  <span className={`text-[0.625rem] font-mono ${sub}`}>Step {i + 1}{i === arr.length - 1 ? ' · finish' : ''}</span>
                                  {isHere && <span className={`text-[0.625rem] font-bold ml-auto ${day ? 'text-amber-800' : 'text-amber-300'}`}>YOU ARE HERE</span>}
                                </div>
                                <div className={`text-[0.75rem] font-bold leading-snug ${isCompleted ? 'line-through opacity-60' : ''} ${txt}`}>{step.name}</div>
                                {(step as any).isGeneric && !isCompleted && (
                                  <div className={`text-[0.5625rem] mt-0.5 italic ${sub}`}>Generic step. Will refine after milestone</div>
                                )}
                                {/* Avoidance (red) or Suggestions (green), for this step. */}
                                {note && (
                                  <div className={`mt-1.5 rounded-md border px-2 py-1 ${note.tone === 'avoid' ? (day ? 'border-red-200 bg-red-50 text-red-800' : 'border-red-800 bg-red-950/40 text-red-200') : (day ? 'border-green-200 bg-green-50 text-green-900' : 'border-green-800 bg-green-950/40 text-green-200')}`} data-step-notes={note.tone}>
                                    <div className="text-[0.625rem] font-bold">{note.tone === 'avoid' ? 'Avoid at this step' : 'Try at this step'}</div>
                                    <ul className="mt-0.5 space-y-0.5 text-[0.6875rem] font-medium">
                                      {note.items.map((item) => <li key={item}>{note.tone === 'avoid' ? '✕' : '✓'} {item}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              {/* Heart + Complete buttons */}
                              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); toggleHeart(step.id) }} aria-pressed={isHearted} aria-label={`Favourite: ${step.name}`} className={`text-sm transition-transform hover:scale-125 ${isHearted ? '' : 'opacity-40 hover:opacity-100'}`}>
                                  {isHearted ? '❤️' : '🤍'}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); toggleMilestoneComplete(step.id, step.name) }} role="checkbox" aria-checked={isCompleted} aria-label={`Done: ${step.name}`} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isCompleted ? `${day ? 'bg-emerald-500 border-emerald-500' : 'bg-emerald-600 border-emerald-600'}` : `${day ? 'border-slate-300 hover:border-emerald-400' : 'border-indigo-600 hover:border-emerald-500'}`}`}>
                                  {isCompleted && <span className="text-white text-[0.5rem] font-bold">✓</span>}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                    })()}
                  </div>
                  </div>

                  {/* Nav arrows to switch dimensions */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-dashed" style={{ borderColor: day ? '#e2e8f0' : '#312e81' }}>
                    <button
                      onClick={() => {
                        const idx = dimOrder.findIndex(d => d.key === activeDimension)
                        const prev = dimOrder[(idx - 1 + dimOrder.length) % dimOrder.length]
                        setActiveDimension(prev.key); setActiveDimRace(null)
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[0.625rem] font-bold ${day ? 'bg-white/60 text-slate-600 hover:bg-white' : 'bg-indigo-950/40 text-indigo-400 hover:bg-indigo-900'} transition-all`}
                    >
                      ← {dimOrder[(dimOrder.findIndex(d => d.key === activeDimension) - 1 + dimOrder.length) % dimOrder.length].label}
                    </button>
                    <span className={`text-[0.5625rem] ${sub}`}>{dimOrder.findIndex(d => d.key === activeDimension) + 1} / {dimOrder.length}</span>
                    <button
                      onClick={() => {
                        const idx = dimOrder.findIndex(d => d.key === activeDimension)
                        const next = dimOrder[(idx + 1) % dimOrder.length]
                        setActiveDimension(next.key); setActiveDimRace(null)
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[0.625rem] font-bold ${day ? 'bg-white/60 text-slate-600 hover:bg-white' : 'bg-indigo-950/40 text-indigo-400 hover:bg-indigo-900'} transition-all`}
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
            <div className="w-full px-2 pt-4 pb-8">
              {milestones.length === 0 ? (
                <div className={`max-w-md mx-auto text-center rounded-2xl border-2 border-dashed p-6 ${day ? 'border-slate-300 bg-white/60' : 'border-indigo-700 bg-indigo-950/40'}`}>
                  <div className="text-3xl mb-2">🗺️</div>
                  <div className={`text-sm font-bold ${txt}`}>No trail yet</div>
                  <p className={`text-xs mt-1 ${sub}`}>Finish onboarding and your milestones become the map.</p>
                </div>
              ) : (
                <div className="grid items-start gap-4 lg:grid-cols-[180px_minmax(0,1fr)_180px]">
                <aside className="order-2 lg:order-1 lg:pt-[var(--active-stop)]" style={{ '--active-stop': `${activeStopY}px` } as React.CSSProperties}>
                  <h3 className="mb-2 font-semibold">Pit Stop</h3>
                  <div className="flex flex-wrap gap-3 text-sm lg:flex-col"><Link className="underline" href={goHubHref('/')}>ResourceHub</Link><Link className="underline" href="/hare-world">Hare World</Link><Link className="underline" href={goHubHref('/community')}>Tidbits</Link></div>
                </aside>
                <div className="order-1 min-w-0 lg:order-2"><MilestoneTrail
                  milestones={trackStops as any}
                  completedIds={completedMilestoneIds}
                  currentIndex={currentStopIdx}
                  startIndex={trackStart}
                  previewAll
                  bottomUp
                  notes={stepNotes}
                  ahead={stepsAhead}
                  character={trailCharacter}
                  // Open THAT milestone, not the list. Every node used to
                  // push to /milestones, so all 144 of them led to the same
                  // screen — which is why they looked identical.
                  onSelect={(m: any) => router.push(`/milestones/${m.id}`)}
                  day={day}
                /></div>
                <aside className="order-3 lg:pt-[var(--active-stop)]" style={{ '--active-stop': `${activeStopY}px` } as React.CSSProperties}>
                  <h3 className="mb-2 font-semibold">Current milestone</h3>
                  <p className="break-words text-sm">{trackStops[currentStopIdx]?.name || 'All milestones completed'}</p>
                  <Link href="/calendar" className="mt-3 inline-block text-sm underline">Calendar</Link>
                </aside>
                </div>
              )}
            </div>
          )}

          {showPads && (
            milestones.length === 0 ? (
              <p className={`py-8 text-center text-sm ${sub}`}>Finish setup and your milestones appear here.</p>
            ) : (
              <AnyOrderPond
                milestones={milestones as any}
                completedIds={completedMilestoneIds}
                onToggle={(id: string) => toggleMilestoneComplete(id, milestones.find((m: any) => m.id === id)?.name)}
                day={day}
                character={myCharacter ? <UserAvatar {...myCharacter} size={32} /> : <DefaultAvatar size={32} />}
              />
            )
          )}

          {showSeparateTrack && (
            <div className="w-full pt-6">
              {/* Dream Self renders once in the shared top block above. */}
              <FanOut count={5} />
              <div className={`text-center mb-3 text-[0.625rem] ${sub}`}>Each life dimension runs as its own parallel track</div>

              {/* One painted world, five territories. Previously a grid of
                  white cards with headers and progress bars — which kept it a
                  dashboard with round buttons in it. A level map has no cards:
                  the world is the background and the tracks run through it. */}
              <LaneWorld
                completedIds={completedMilestoneIds}
                day={day}
                onSelect={(_k, st) => router.push(`/milestones/${st.id}`)}
                lanes={dimMeta.map(dim => {
                  const dimMs = milestones.filter((m: any) => _normDim(m.dimension) === dim.key)
                  const steps = dimMs.length
                    ? dimMs.map((m: any) => ({ id: m.id, name: m.name }))
                    : dim.key === 'barrier'
                      ? recommendedChoices.filter(c => c.id !== 'see').map(c => ({ id: c.id, name: c.name }))
                      : [{ id: `${dim.key}-ph`, name: 'Getting started' }]
                  return {
                    key: dim.key,
                    label: dim.label,
                    emoji: dim.emoji,
                    accent: dim.accent,
                    node: dim.node,
                    nodeDark: dim.nodeDark,
                    band: dim.band,
                    ground: dim.ground,
                    steps,
                  }
                })}
              />

              <FanIn count={5} />
              {/* Shared finish line */}
              <div className="flex flex-col items-center my-2">
                <div className="flex mb-2">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className={`w-4 h-4 ${(Math.floor(i / 1) + (i % 2)) % 2 === 0 ? (day ? 'bg-slate-800' : 'bg-white') : (day ? 'bg-white' : 'bg-slate-800')} ${i === 0 ? 'rounded-l' : ''} ${i === 9 ? 'rounded-r' : ''}`} />
                  ))}
                </div>
                <span className={`px-4 py-1 text-[0.625rem] font-bold uppercase tracking-widest rounded-full shadow-md ${day ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-amber-900/70 text-amber-200 border border-amber-700'}`}>🏁 Start Line. Landing Spot</span>
              </div>

              {/* Storefronts */}
              <div className="flex justify-center"><StorefrontRow /></div>

              {/* Journal */}
              <div className="flex justify-center pb-8">
                <Link href="/reflection?contextType=race" className={`inline-flex items-center gap-2 px-4 py-2 border-2 rounded-xl font-medium hover:shadow-lg transition-all ${pill} ${txt} text-sm`}>
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
            <div
              className="grid gap-x-3 gap-y-4 px-2 justify-items-center"
              style={{ gridTemplateColumns: 'minmax(0,1fr)' }}
            >

              {/* LEFT: Pit Stop Shop. Above the map rather than beside it —
                  flanking panels stole the width the trail needs. */}
              <div className="flex justify-center items-start w-full" style={{ gridColumn: 1, gridRow: 1 }}>
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
                    <h4 className={`font-bold text-xs mb-1.5 flex items-center gap-1.5 ${txt}`}><span aria-hidden="true">🏪</span>Pit Stop Shop</h4>
                    <div className="space-y-1">
                      {shopItems.length === 0 && (
                        <p className={`text-[0.5625rem] ${sub} py-1`}>No items yet. They appear as your agents recommend tools.</p>
                      )}
                      {shopItems.slice(0, expandShop ? shopItems.length : 3).map((item, i) => (
                        <button key={i} className={`w-full flex items-center gap-1.5 p-1 rounded-lg text-left transition-all hover:scale-[1.02] ${day ? 'bg-white/60 hover:bg-white/90' : 'bg-indigo-800/40 hover:bg-indigo-700/50'}`}>
                          <span className="text-base">{item.emoji}</span>
                          <div>
                            <div className={`text-[0.625rem] font-bold ${txt}`}>{item.name}</div>
                            <div className={`text-[0.5rem] ${sub}`}>{item.cost}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {/* Up/Down scroll arrows */}
                    <div className="flex justify-center gap-2 mt-1.5">
                      <button onClick={() => setExpandShop(false)} className={`w-6 h-6 flex items-center justify-center rounded-lg border-2 ${day ? 'border-amber-400 bg-amber-100 text-amber-700' : 'border-indigo-500 bg-indigo-800 text-indigo-300'} hover:bg-black/10 transition-all`}>
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => setExpandShop(true)} className={`w-6 h-6 flex items-center justify-center rounded-lg border-2 ${day ? 'border-amber-400 bg-amber-100 text-amber-700' : 'border-indigo-500 bg-indigo-800 text-indigo-300'} hover:bg-black/10 transition-all`}>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <a href={goHubHref('/')} target="_blank" rel="noopener noreferrer" className={`block text-center text-[0.625rem] font-bold mt-2 px-3 py-1.5 rounded-lg shadow transition-all hover:scale-105 ${day ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'}`}>🏪 Open Full Shop →</a>
                  </div>
                </div>
                </div>
              </div>

              {/* CENTRE: the map itself.
                  This was a card per step with a dot beside it — a list with
                  icons, not a level map. It is now the same node trail as the
                  Trail Map view: a winding path through painted ground with
                  the steps AS the nodes. No cards. */}
              <div className="w-full max-w-[440px] mx-auto" style={{ gridColumn: 1, gridRow: 2 }}>
                <MilestoneTrail
                  milestones={trackStops.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    status: m.status,
                    dimension: m.dimension,
                    dimensionLabel: m.dimensionLabel,
                  }))}
                  completedIds={completedMilestoneIds}
                  currentIndex={0 /* the trail derives it from completedIds */}
                  startIndex={trackStart}
                  bottomUp
                  notes={stepNotes}
                  ahead={stepsAhead}
                  day={day}
                  character={trailCharacter}
                  onSelect={(m: any) => router.push(`/milestones/${m.id}`)}
                />
              </div>

              {/* RIGHT: current goals + per-path progress, in the current dot's
                  row. The progress bars are Liam's ask — the check marks alone
                  made it hard to read how far along a path you actually are. */}
              <div className="flex justify-center items-start w-full" style={{ gridColumn: 1, gridRow: 3 }}>
                <div className={`w-full max-w-[190px] ${pill} border-2 rounded-xl shadow-md p-2.5`}>
                  <h4 className={`font-bold text-xs mb-1.5 flex items-center gap-1.5 ${txt}`}><span aria-hidden="true">🏁</span>Current Goals</h4>
                  <div className="space-y-2">
                    {races.filter((r: any) => r.id !== 'r_placeholder').slice(0, 3).map((r: any) => (
                      <div key={r.id}>
                        <div className={`text-[0.625rem] font-bold ${txt}`}>{r.name}</div>
                        <div className={`h-1.5 rounded-full overflow-hidden mt-0.5 ${day ? 'bg-sky-100' : 'bg-indigo-800'}`}>
                          <div className="h-full bg-gradient-to-r from-sky-400 to-purple-400 rounded-full transition-all" style={{ width: `${r.progress}%` }} />
                        </div>
                        <div className={`text-[0.5625rem] ${sub} mt-0.5`}>{r.progress}% · {r.milestone}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => router.push('/onboarding?step=3')} className={`w-full mt-2 text-[0.625rem] font-bold px-2 py-1.5 rounded-lg border-2 border-dashed transition-all hover:brightness-105 ${txt}`}>➕ Add another goal</button>
                  {userBarrierLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {userBarrierLabels.slice(0, 5).map((b: string) => (
                        <span key={b} className={`text-[0.5rem] px-1.5 py-0.5 rounded ${day ? 'bg-sky-100 text-sky-700' : 'bg-sky-900/50 text-sky-300'}`}>{b}</span>
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
          <button onClick={() => setShowPreviousSteps(!showPreviousSteps)} className={`flex items-center gap-1 text-[0.625rem] ${sub} hover:bg-black/10`}>
            {showPreviousSteps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span className="italic">(previous steps)</span>
          </button>
          {showPreviousSteps && (
            <div className="space-y-1 max-w-[240px] mt-1 mb-1">
              {previousSteps.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 text-[0.625rem]">
                  <div className="w-3.5 h-3.5 rounded-full bg-sky-400 flex items-center justify-center flex-shrink-0"><span className="text-white text-[0.4375rem]">✓</span></div>
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
            <span className={`px-4 py-1 text-[0.625rem] font-bold uppercase tracking-widest rounded-full shadow-md ${day ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-amber-900/70 text-amber-200 border border-amber-700'}`}>🏁 Start Line. Landing Spot</span>
          </div>


          {/* Final road segment to journal */}
          <RoadDown h={50} />

          {/* Journal */}
          <div className="pb-8">
            <Link href="/reflection?contextType=race" className={`inline-flex items-center gap-2 px-4 py-2 border-2 rounded-xl font-medium hover:shadow-lg transition-all ${pill} ${txt} text-sm`}>
              <Sparkles className="w-4 h-4" /> Journal / Reflection
            </Link>
          </div>
          </>)}
          </div>
        </div>

        <HelpOthersPrompt milestone={helpFor} onClose={() => setHelpFor(null)} />
        {captureFor && (
          <MomentCapture
            open
            kind="milestone"
            refId={captureFor.id}
            title={captureFor.name}
            onClose={() => {
              const done = captureFor
              setCaptureFor(null)
              if (done && !helpPromptOff()) setHelpFor(done)
            }}
          />
        )}

        {/* ═══ MOTIVATION PINWHEEL POPUP ═══ */}
        {showPinwheelPopup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm overlay-scroll" onClick={() => setShowPinwheelPopup(false)}>
            <div className={`relative ${day ? 'bg-white' : 'bg-indigo-950'} rounded-2xl shadow-2xl border ${day ? 'border-slate-200' : 'border-indigo-700'} p-8 max-w-sm w-full mx-4`} onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowPinwheelPopup(false)} className={`absolute top-3 right-3 ${sub} hover:bg-black/10`}><X className="w-5 h-5" /></button>
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
                    <div className={`text-[0.625rem] font-bold uppercase tracking-wider ${sub} mb-1`}>Today&apos;s Motivation</div>
                    <div className={`text-base italic ${txt}`}>&ldquo;{todaysMotivation}&rdquo;</div>
                  </div>
                ) : (
                  <p className={`text-sm ${sub}`}>Tap the wheel to spin!</p>
                )}
              </div>

              {/* Placement customization — records the user's choice */}
              <div className={`mt-6 pt-4 border-t ${day ? 'border-slate-200' : 'border-indigo-700'}`}>
                <div className={`text-[0.625rem] font-bold uppercase tracking-wider ${sub} mb-2 text-center`}>Pinwheel placement</div>
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
    <Suspense fallback={<div className="p-8 text-center text-lg">Loading your Races…</div>}>
      <RacesContent />
    </Suspense>
  )
}
