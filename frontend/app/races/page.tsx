'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ChevronDown, ChevronUp, ExternalLink, ArrowLeft, Users, UserCheck, UserPlus, Bell, Trophy, RefreshCw, Filter, X, Info, AlertTriangle, Send, MessageSquare, Eye } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'
import AgentInsightsBanner from '../components/AgentInsightsBanner'

/*
  DREAM LAND — One continuous race-track roadmap.
  Roads are HTML elements IN the document flow (not a background SVG),
  so they always stay connected to the content.
  Pit Stop Shop opens ServiceHub. Milestone sign is a signboard.
*/

function RacesContent() {
  const { payload, pathPlanning, toolRecommendation } = useAgentPath()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isDayTheme, setIsDayTheme] = useState(true)
  const [showRocketEntry, setShowRocketEntry] = useState(true)
  const [rocketPhase, setRocketPhase] = useState<'flying' | 'landing' | 'landed'>('flying')
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

  /* ═══ MOCK DATA FOR OTHER PEOPLE'S RACE TRACKS ═══ */
  const comparePeople = {
    rolemodel: {
      name: 'Sarah Chen',
      avatar: '👩‍🔬',
      relation: 'Role Model',
      dreamSelf: 'Tenured Professor & Research Lead',
      races: [
        { id: 'rm1', name: 'Get PhD in CS', progress: 85, milestone: 'Defend Dissertation' },
        { id: 'rm2', name: 'Publish 5 Papers', progress: 100, milestone: 'Complete!' },
        { id: 'rm3', name: 'Secure Faculty Position', progress: 60, milestone: 'Campus Interviews' },
      ],
      stats: [
        { name: 'Mentality', value: 9, max: 10 },
        { name: 'Happiness', value: 8, max: 10 },
        { name: 'Fear', value: 2, max: 10 },
        { name: 'Creativity', value: 9, max: 10 },
      ],
      milestones: [
        { name: 'Defend Dissertation', dist: 'Current', status: 'active' as const },
        { name: 'Submit Final Paper', dist: '1 step', status: 'upcoming' as const },
        { name: 'Faculty Interviews', dist: '3 steps', status: 'upcoming' as const },
        { name: 'Secure Grant Funding', dist: '5 steps', status: 'upcoming' as const },
        { name: 'Start Lab', dist: '8 steps', status: 'far' as const },
        { name: 'Get Tenure', dist: '15 steps', status: 'far' as const },
      ],
      completedSteps: [
        'Published 5 peer-reviewed papers',
        'Completed coursework with 4.0 GPA',
        'Won Best Paper Award',
        'TA\'d 3 semesters',
        'Passed qualifying exams',
      ],
      models: ['Autism', 'Woman in STEM', 'Immigrant'],
    },
    friend: {
      name: 'Marcus Williams',
      avatar: '👨‍🎨',
      relation: 'Friend-val',
      dreamSelf: 'Full-Stack Developer & Indie Game Creator',
      races: [
        { id: 'f1', name: 'Land Tech Job', progress: 55, milestone: 'Technical Interviews' },
        { id: 'f2', name: 'Ship Indie Game', progress: 30, milestone: 'Build Demo' },
      ],
      stats: [
        { name: 'Mentality', value: 6, max: 10 },
        { name: 'Happiness', value: 7, max: 10 },
        { name: 'Fear', value: 5, max: 10 },
        { name: 'Creativity', value: 8, max: 10 },
      ],
      milestones: [
        { name: 'Technical Interviews', dist: 'Current', status: 'active' as const },
        { name: 'Accept Offer', dist: '2 steps', status: 'upcoming' as const },
        { name: 'Ship Game Demo', dist: '5 steps', status: 'far' as const },
      ],
      completedSteps: [
        'Built portfolio website',
        'Completed 3 coding bootcamp projects',
        'Got 2 referrals',
      ],
      models: ['ADHD', 'First-Gen', 'Visible Minority'],
    },
    mentor: {
      name: 'Dr. James Park',
      avatar: '👨‍💼',
      relation: 'Mentor',
      dreamSelf: 'VP of Engineering & Community Leader',
      races: [
        { id: 'm1', name: 'VP of Engineering', progress: 92, milestone: 'Board Presentation' },
        { id: 'm2', name: 'Launch Mentorship Nonprofit', progress: 70, milestone: 'Secure 501(c)(3)' },
        { id: 'm3', name: 'Write Technical Book', progress: 45, milestone: 'Finish Draft' },
        { id: 'm4', name: 'Build Dream Home', progress: 20, milestone: 'Find Land' },
      ],
      stats: [
        { name: 'Mentality', value: 9, max: 10 },
        { name: 'Happiness', value: 9, max: 10 },
        { name: 'Fear', value: 1, max: 10 },
        { name: 'Creativity', value: 7, max: 10 },
      ],
      milestones: [
        { name: 'Board Presentation', dist: 'Current', status: 'active' as const },
        { name: 'Get VP Title', dist: '1 step', status: 'upcoming' as const },
        { name: 'Secure 501(c)(3)', dist: '3 steps', status: 'upcoming' as const },
        { name: 'Finish Book Draft', dist: '6 steps', status: 'upcoming' as const },
        { name: 'Publish Book', dist: '8 steps', status: 'far' as const },
        { name: 'Open Community Center', dist: '12 steps', status: 'far' as const },
        { name: 'Retire & Advise', dist: '20 steps', status: 'far' as const },
      ],
      completedSteps: [
        'Promoted to Senior Director',
        'Led 50-person engineering org',
        'Mentored 20+ engineers',
        'Spoke at 5 conferences',
        'Drafted nonprofit charter',
        'Published 3 blog posts',
      ],
      models: ['ADHD', 'Dyslexia', 'Immigrant'],
    },
  } as const

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
  // Derive stats from the real user profile so the radar reflects them.
  const _userBarrierCount = (payload?.userProfile?.barrierTypes || []).length
  const _userGoalCount = (payload?.userProfile?.goals || []).length
  const _userDreamCount = (payload?.userProfile?.dreams || []).length
  const _userChallengeCount = (payload?.userProfile?.currentChallenges || []).length
  const _clamp = (n: number) => Math.max(1, Math.min(10, n))
  const stats = [
    { name: 'Mentality', value: _clamp(4 + _userBarrierCount), max: 10 },
    { name: 'Happiness', value: _clamp(5 + _userDreamCount), max: 10 },
    { name: 'Fear', value: _clamp(2 + _userChallengeCount), max: 10 },
    { name: 'Creativity', value: _clamp(4 + _userGoalCount + _userDreamCount), max: 10 },
  ]
  const motivations = ['Focus on progress, not perfection', 'One small step at a time', 'Your barriers are your superpowers', 'Rest is part of the journey', 'Celebrate every win', 'You are enough']
  // Recommended choices for the CURRENT milestone come from the
  // tool_recommendation agent. Fall back to the demo list if we have none.
  const _agentMs: any[] = (pathPlanning?.milestones || []) as any[]
  const _currentMsId: string | undefined = _agentMs[0]?.id
  const _currentRecs: any[] = _currentMsId ? ((toolRecommendation?.recommendations || {})[_currentMsId] || []) : []
  const _agentChoices = _currentRecs.slice(0, 3).map((t: any, i: number) => ({
    id: `c${i + 1}`,
    name: t.name || `Recommended Choice ${i + 1}`,
    success: Math.round((t.relevanceScore || 0.85) * 100),
    attempts: t.reviews || 100 + i * 25,
  }))
  const recommendedChoices = _agentChoices.length
    ? [
        ..._agentChoices,
        { id: 'see', name: '(See more)', success: null as any, attempts: null as any },
        _currentRecs[3]
          ? { id: 'cX', name: _currentRecs[3].name || 'Choice X, Last', success: Math.round(((_currentRecs[3].relevanceScore || 0.1)) * 100), attempts: _currentRecs[3].reviews || 102 }
          : { id: 'cX', name: 'Choice X, Last', success: 10, attempts: 102 },
      ]
    : [
        { id: 'c1', name: 'Recommended Choice 1', success: 90, attempts: 1000 },
        { id: 'c2', name: 'Recommended Choice 2', success: 89, attempts: 101 },
        { id: 'see', name: '(See more)', success: null as any, attempts: null as any },
        { id: 'cX', name: 'Choice X, Last', success: 10, attempts: 102 },
      ]
  const previousSteps = [
    { id: 's1', name: 'Completed: Research accommodations' },
    { id: 's2', name: 'Completed: Initial assessment' },
    { id: 's3', name: 'Completed: Set up profile' },
  ]
  // Real agent-derived races (fallback to mock if no path data yet)
  const userBarrierLabels: string[] = (payload?.userProfile?.barrierTypes || []) as string[]
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
      })) || [
        { id: 'r1', name: 'Graduate University', progress: 45, milestone: 'Request Accommodations', models: ['Autism', 'ADHD', 'First-Gen'] },
        { id: 'r2', name: 'Get Tech Job', progress: 20, milestone: 'Build Portfolio', models: ['ADHD', 'Visible Minority'] },
      ]
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
      }))
    : [
        { id: 'm0', name: 'Request Accommodations', dist: 'Current', status: 'active' as const, dimension: '', dimensionLabel: '', goal: '' },
        { id: 'm1', name: 'Complete Semester 1', dist: '2 steps', status: 'upcoming' as const, dimension: '', dimensionLabel: '', goal: '' },
        { id: 'm2', name: 'Join Study Group', dist: '4 steps', status: 'upcoming' as const, dimension: '', dimensionLabel: '', goal: '' },
        { id: 'm3', name: 'Graduate!', dist: '10 steps', status: 'far' as const, dimension: '', dimensionLabel: '', goal: '' },
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
    setTimeout(() => { setTodaysMotivation(motivations[Math.floor(Math.random() * motivations.length)]); setIsWheelSpinning(false) }, 2000)
  }

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
              <button onClick={() => router.back()} className={`p-1 rounded-lg hover:opacity-70 ${txt}`}><ArrowLeft className="w-5 h-5" /></button>
              <h1 className={`text-lg font-bold ${txt}`}>🏁 Dream Land Race Track</h1>
            </div>
            <div className="flex items-center gap-1.5">
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

        {/* ═══ COMPARISON: SIDE-BY-SIDE RACE TRACK VIEWS ═══ */}
        {comparisonView && (comparisonView === 'rolemodel' || comparisonView === 'friend' || comparisonView === 'mentor') && (() => {
          const person = comparePeople[comparisonView]
          return (
            <div className="relative z-30 max-w-6xl mx-auto px-3 pt-3 pb-6">
              {/* Close bar */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className={`w-4 h-4 ${sub}`} />
                  <span className={`text-sm font-bold ${txt}`}>Comparing: You vs {person.name} ({person.relation})</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${day ? 'bg-sky-100 text-sky-700' : 'bg-indigo-800 text-indigo-300'}`}>Read-only</span>
                </div>
                <button onClick={() => router.push('/races')} className={`p-1.5 rounded-lg hover:opacity-60 ${day ? 'bg-slate-100' : 'bg-indigo-900'} ${txt}`}><X className="w-5 h-5" /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* ═══ YOUR TRACK (left) ═══ */}
                <div className={`${day ? 'bg-white/70 border-slate-200' : 'bg-indigo-950/60 border-indigo-700'} border rounded-2xl p-4 backdrop-blur-sm`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🧑‍🚀</span>
                    <div>
                      <div className={`font-bold text-sm ${txt}`}>You</div>
                      <div className={`text-[10px] ${sub}`}>Your Dream Land</div>
                    </div>
                  </div>

                  {/* Dream Self */}
                  <div className={`text-center p-3 rounded-xl mb-3 ${day ? 'bg-gradient-to-b from-purple-50 to-sky-50 border-purple-200' : 'bg-gradient-to-b from-purple-900/30 to-indigo-900/30 border-purple-700'} border`}>
                    <div className="text-2xl mb-1">✨</div>
                    <div className={`font-bold text-xs ${txt}`}>Dream Self</div>
                    <div className={`text-[9px] ${sub}`}>{(payload?.userProfile?.dreams || [])[0] || 'Cloud 9 — Your ideal future'}</div>
                  </div>

                  {/* Your Stats */}
                  <div className={`${pill} border rounded-xl p-3 mb-3`}>
                    <div className={`font-bold text-xs mb-2 ${txt}`}>✨ Stats</div>
                    {stats.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] ${sub} w-16`}>{s.name}</span>
                        <div className={`flex-1 h-1.5 ${day ? 'bg-sky-100' : 'bg-indigo-800'} rounded-full overflow-hidden`}>
                          <div className={`h-full rounded-full ${s.value >= 7 ? 'bg-sky-400' : 'bg-indigo-400'}`} style={{ width: `${(s.value / s.max) * 100}%` }} />
                        </div>
                        <span className={`text-[9px] font-bold ${txt}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Your Races */}
                  <div className={`${pill} border rounded-xl p-3 mb-3`}>
                    <div className={`font-bold text-xs mb-2 ${txt}`}>🏁 Races</div>
                    {races.map(r => (
                      <div key={r.id} className="mb-2 last:mb-0">
                        <div className={`text-[10px] font-bold ${txt}`}>{r.name}</div>
                        <div className={`h-1.5 ${day ? 'bg-sky-100' : 'bg-indigo-800'} rounded-full overflow-hidden mt-1`}>
                          <div className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full" style={{ width: `${r.progress}%` }} />
                        </div>
                        <div className={`text-[9px] ${sub} mt-0.5`}>{r.progress}% · {r.milestone}</div>
                      </div>
                    ))}
                    <div className="flex gap-1 flex-wrap mt-2">
                      {races[0].models.map(m => <span key={m} className={`text-[8px] px-1.5 py-0.5 rounded-full ${day ? 'bg-sky-100 text-sky-700' : 'bg-indigo-800 text-indigo-300'}`}>{m}</span>)}
                    </div>
                  </div>

                  {/* Your Milestones */}
                  <div className="space-y-2 mb-3">
                    <div className={`font-bold text-xs ${txt}`}>🪧 Milestones</div>
                    {milestones.map((m, i) => (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border ${m.status === 'active' ? `${day ? 'bg-amber-50 border-amber-400' : 'bg-amber-900/40 border-amber-600'}` : m.status === 'upcoming' ? `${day ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-950/20 border-amber-800'}` : `${day ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/30 border-slate-700'} opacity-50`}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${m.status === 'active' ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : m.status === 'upcoming' ? `${day ? 'bg-amber-200' : 'bg-amber-900'}` : `${day ? 'bg-slate-200' : 'bg-slate-800'}`}`}>
                          {m.status === 'active' ? '📍' : m.status === 'upcoming' ? '🪧' : '🏁'}
                        </div>
                        <div>
                          <div className={`text-[10px] font-bold ${txt}`}>{m.name}</div>
                          <div className={`text-[8px] ${sub}`}>{m.dist}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Your Completed Steps */}
                  <div className={`${pill} border rounded-xl p-3`}>
                    <div className={`font-bold text-xs mb-1.5 ${txt}`}>✅ Completed</div>
                    {previousSteps.map(s => (
                      <div key={s.id} className="flex items-center gap-1.5 mb-1">
                        <div className="w-3 h-3 rounded-full bg-sky-400 flex items-center justify-center flex-shrink-0"><span className="text-white text-[6px]">✓</span></div>
                        <span className={`text-[9px] ${sub}`}>{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ═══ THEIR TRACK (right) ═══ */}
                <div className={`${day ? 'bg-gradient-to-b from-emerald-50/80 to-white/70 border-emerald-200' : 'bg-gradient-to-b from-emerald-950/40 to-indigo-950/60 border-emerald-800'} border rounded-2xl p-4 backdrop-blur-sm relative`}>
                  {/* Read-only badge */}
                  <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${day ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-900/60 text-emerald-300'}`}>
                    <Eye className="w-3 h-3" /> View Only
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{person.avatar}</span>
                    <div>
                      <div className={`font-bold text-sm ${txt}`}>{person.name}</div>
                      <div className={`text-[10px] ${sub}`}>{person.relation}</div>
                    </div>
                  </div>

                  {/* Their Dream Self */}
                  <div className={`text-center p-3 rounded-xl mb-3 ${day ? 'bg-gradient-to-b from-emerald-50 to-teal-50 border-emerald-200' : 'bg-gradient-to-b from-emerald-900/30 to-teal-900/30 border-emerald-700'} border`}>
                    <div className="text-2xl mb-1">✨</div>
                    <div className={`font-bold text-xs ${txt}`}>{person.dreamSelf}</div>
                    <div className={`text-[9px] ${sub}`}>Their Dream Self</div>
                  </div>

                  {/* Their Stats */}
                  <div className={`${day ? 'bg-white/60 border-emerald-100' : 'bg-indigo-900/40 border-emerald-800'} border rounded-xl p-3 mb-3`}>
                    <div className={`font-bold text-xs mb-2 ${txt}`}>✨ Stats</div>
                    {person.stats.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] ${sub} w-16`}>{s.name}</span>
                        <div className={`flex-1 h-1.5 ${day ? 'bg-emerald-100' : 'bg-emerald-900/40'} rounded-full overflow-hidden`}>
                          <div className={`h-full rounded-full ${s.value >= 7 ? 'bg-emerald-400' : 'bg-teal-400'}`} style={{ width: `${(s.value / s.max) * 100}%` }} />
                        </div>
                        <span className={`text-[9px] font-bold ${txt}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Their Races */}
                  <div className={`${day ? 'bg-white/60 border-emerald-100' : 'bg-indigo-900/40 border-emerald-800'} border rounded-xl p-3 mb-3`}>
                    <div className={`font-bold text-xs mb-2 ${txt}`}>🏁 Races</div>
                    {person.races.map(r => (
                      <div key={r.id} className="mb-2 last:mb-0">
                        <div className={`text-[10px] font-bold ${txt}`}>{r.name}</div>
                        <div className={`h-1.5 ${day ? 'bg-emerald-100' : 'bg-emerald-900/40'} rounded-full overflow-hidden mt-1`}>
                          <div className={`h-full rounded-full ${r.progress === 100 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`} style={{ width: `${r.progress}%` }} />
                        </div>
                        <div className={`text-[9px] ${sub} mt-0.5`}>{r.progress}% · {r.milestone}</div>
                      </div>
                    ))}
                    <div className="flex gap-1 flex-wrap mt-2">
                      {person.models.map(m => <span key={m} className={`text-[8px] px-1.5 py-0.5 rounded-full ${day ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-900/40 text-emerald-300'}`}>{m}</span>)}
                    </div>
                  </div>

                  {/* Their Milestones */}
                  <div className="space-y-2 mb-3">
                    <div className={`font-bold text-xs ${txt}`}>🪧 Milestones</div>
                    {person.milestones.map((m, i) => (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border ${m.status === 'active' ? `${day ? 'bg-emerald-50 border-emerald-400' : 'bg-emerald-900/40 border-emerald-600'}` : m.status === 'upcoming' ? `${day ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800'}` : `${day ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/30 border-slate-700'} opacity-50`}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${m.status === 'active' ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white' : m.status === 'upcoming' ? `${day ? 'bg-emerald-200' : 'bg-emerald-900'}` : `${day ? 'bg-slate-200' : 'bg-slate-800'}`}`}>
                          {m.status === 'active' ? '📍' : m.status === 'upcoming' ? '🪧' : '🏁'}
                        </div>
                        <div>
                          <div className={`text-[10px] font-bold ${txt}`}>{m.name}</div>
                          <div className={`text-[8px] ${sub}`}>{m.dist}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Their Completed Steps */}
                  <div className={`${day ? 'bg-white/60 border-emerald-100' : 'bg-indigo-900/40 border-emerald-800'} border rounded-xl p-3 mb-3`}>
                    <div className={`font-bold text-xs mb-1.5 ${txt}`}>✅ Completed ({person.completedSteps.length})</div>
                    {person.completedSteps.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5 mb-1">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 flex items-center justify-center flex-shrink-0"><span className="text-white text-[6px]">✓</span></div>
                        <span className={`text-[9px] ${sub}`}>{s}</span>
                      </div>
                    ))}
                  </div>

                  {/* Suggestion box */}
                  <div className={`${day ? 'bg-purple-50 border-purple-200' : 'bg-purple-900/30 border-purple-700'} border rounded-xl p-3`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <MessageSquare className={`w-3.5 h-3.5 ${day ? 'text-purple-500' : 'text-purple-400'}`} />
                      <span className={`font-bold text-xs ${day ? 'text-purple-700' : 'text-purple-300'}`}>Send a Suggestion</span>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={suggestionText}
                        onChange={e => setSuggestionText(e.target.value)}
                        placeholder="e.g. Try the Pomodoro technique!"
                        className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] border ${day ? 'bg-white border-purple-200 text-slate-800 placeholder:text-slate-400' : 'bg-indigo-950 border-purple-700 text-white placeholder:text-indigo-400'} focus:outline-none focus:ring-1 focus:ring-purple-400`}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && suggestionText.trim()) {
                            setSentSuggestions(prev => [...prev, { to: person.name, text: suggestionText.trim() }])
                            setSuggestionText('')
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (suggestionText.trim()) {
                            setSentSuggestions(prev => [...prev, { to: person.name, text: suggestionText.trim() }])
                            setSuggestionText('')
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105 ${day ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'}`}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {sentSuggestions.filter(s => s.to === person.name).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {sentSuggestions.filter(s => s.to === person.name).map((s, i) => (
                          <div key={i} className={`text-[9px] px-2 py-1 rounded-lg ${day ? 'bg-purple-100 text-purple-700' : 'bg-purple-800/40 text-purple-300'}`}>
                            💬 You suggested: &ldquo;{s.text}&rdquo;
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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
              {newView === 'avoidance' && <div className="space-y-1.5">{[{ t: 'All-night study', r: 'Triggers burnout' }, { t: 'Cramming', r: 'Increases anxiety' }, { t: 'Skipping meals', r: 'Affects focus' }, { t: 'Overcommitting', r: 'Overwhelm' }].map((x, i) => <div key={i} className={`flex items-start gap-2 p-2 ${day ? 'bg-red-50 border-red-200' : 'bg-red-900/30 border-red-800'} border rounded-lg`}><AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" /><div><div className={`font-medium text-xs ${day ? 'text-red-900' : 'text-red-300'}`}>{x.t}</div><div className={`text-[10px] ${day ? 'text-red-700' : 'text-red-400'}`}>{x.r}</div></div></div>)}</div>}
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

          {/* ═══════════════════
              DREAM SELF (top)
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
          </div>

          {/* ─── ROAD: fan out from Dream Self into 5 paths ─── */}
          <FanOut count={5} />

          {/* ─── Content sitting on the 5 paths (goals, stats, etc.) ─── */}
          <div className="w-full grid grid-cols-5 gap-2 px-1 max-w-lg">
            <div className={`${pill} border rounded-lg p-2 shadow-sm text-center`}>
              <div className="text-base">🎯</div>
              <div className={`font-bold text-[9px] ${txt}`}>{races[0].name}</div>
              <div className={`h-1 ${day ? 'bg-sky-100' : 'bg-indigo-800'} rounded-full mt-1 overflow-hidden`}><div className="h-full bg-gradient-to-r from-sky-400 to-purple-400 rounded-full" style={{ width: `${races[0].progress}%` }} /></div>
              <div className={`text-[8px] ${sub}`}>{races[0].progress}%</div>
            </div>
            <div className={`${pill} border rounded-lg p-1.5 shadow-sm`}>
              <div className={`font-bold text-[8px] mb-0.5 ${txt}`}>✨Stats</div>
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-0.5 mb-0.5">
                  <span className={`text-[7px] ${sub} w-9 truncate`}>{s.name}</span>
                  <div className={`flex-1 h-0.5 ${day ? 'bg-sky-100' : 'bg-indigo-800'} rounded-full overflow-hidden`}><div className={`h-full rounded-full ${s.value >= 7 ? 'bg-sky-400' : 'bg-indigo-400'}`} style={{ width: `${(s.value / s.max) * 100}%` }} /></div>
                </div>
              ))}
            </div>
            <div className={`${day ? 'bg-purple-50/80 border-purple-200' : 'bg-purple-900/50 border-purple-700'} border rounded-lg p-2 shadow-sm text-center`}>
              <div className="text-base">☁️</div>
              <div className={`font-bold text-[9px] ${txt}`}>Cloud 9</div>
              <div className={`text-[7px] ${sub}`}>Vision</div>
            </div>
            <div className={`${pill} border rounded-lg p-2 shadow-sm text-center`}>
              <div className="text-base">🎯</div>
              <div className={`font-bold text-[9px] ${txt}`}>{races[1].name}</div>
              <div className={`h-1 ${day ? 'bg-sky-100' : 'bg-indigo-800'} rounded-full mt-1 overflow-hidden`}><div className="h-full bg-gradient-to-r from-sky-400 to-indigo-400 rounded-full" style={{ width: `${races[1].progress}%` }} /></div>
              <div className={`text-[8px] ${sub}`}>{races[1].progress}%</div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <button onClick={spinWheel} disabled={isWheelSpinning} className="relative">
                <svg viewBox="0 0 50 50" className="w-10 h-10 transition-transform duration-[2000ms] ease-out" style={{ transform: `rotate(${wheelRotation}deg)` }}>
                  {[0, 60, 120, 180, 240, 300].map((a, i) => { const c = day ? ['#38bdf8', '#818cf8', '#f59e0b', '#34d399', '#f472b6', '#60a5fa'] : ['#0ea5e9', '#6366f1', '#d97706', '#059669', '#ec4899', '#3b82f6']; const sa = (a - 90) * Math.PI / 180, ea = (a + 60 - 90) * Math.PI / 180; return <path key={i} d={`M25 25 L${25 + 20 * Math.cos(sa)} ${25 + 20 * Math.sin(sa)} A20 20 0 0 1 ${25 + 20 * Math.cos(ea)} ${25 + 20 * Math.sin(ea)}Z`} fill={c[i]} stroke="white" strokeWidth="1" /> })}
                  <circle cx="25" cy="25" r="6" fill="white" stroke={line} strokeWidth="1" />
                  <text x="25" y="27" textAnchor="middle" fontSize="4" fontWeight="bold" fill={line}>SPIN</text>
                </svg>
              </button>
              {todaysMotivation && <div className={`text-[7px] italic ${txt} text-center mt-0.5 max-w-[70px] leading-tight`}>{todaysMotivation}</div>}
            </div>
          </div>

          {/* ─── ROAD: 5 paths converge back to character ─── */}
          <FanIn count={5} />

          {/* ═══════════════════════════════════════
              FOUR DIMENSION LANES — Education /
              Workplace / Relationships / Health
              Each lane is its own mini-roadmap for
              the SAME goal, tagged with barriers.
             ═══════════════════════════════════════ */}
          {(() => {
            const dimOrder: Array<{ key: string; label: string; emoji: string; tint: string; tintDark: string }> = [
              { key: 'education',     label: 'Education',          emoji: '🎓', tint: 'from-sky-50 to-white border-sky-200',         tintDark: 'from-sky-900/40 to-indigo-950/60 border-sky-800' },
              { key: 'workplace',     label: 'Workplace',          emoji: '💼', tint: 'from-amber-50 to-white border-amber-200',     tintDark: 'from-amber-900/40 to-indigo-950/60 border-amber-800' },
              { key: 'relationships', label: 'Relationships',      emoji: '🤝', tint: 'from-pink-50 to-white border-pink-200',       tintDark: 'from-pink-900/40 to-indigo-950/60 border-pink-800' },
              { key: 'health',        label: 'Health & Lifestyle', emoji: '🌱', tint: 'from-emerald-50 to-white border-emerald-200', tintDark: 'from-emerald-900/40 to-indigo-950/60 border-emerald-800' },
            ]
            const byDim: Record<string, typeof milestones> = { education: [], workplace: [], relationships: [], health: [] }
            milestones.forEach(m => {
              const k = ((m as any).dimension || '').toLowerCase()
              const norm = k === 'career' ? 'workplace' : k
              if (byDim[norm]) byDim[norm].push(m)
            })
            // If the agent payload predates dimensions, fall back to one
            // single lane labelled "Roadmap" so we still render everything.
            const hasAnyDim = Object.values(byDim).some(arr => arr.length > 0)
            return (
              <div className="w-full px-4 py-6">
                <div className={`text-center mb-4 font-bold text-sm ${txt}`}>
                  🛣️ Four life dimensions, one goal
                </div>
                {hasAnyDim ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {dimOrder.map(dim => {
                      const lane = byDim[dim.key]
                      return (
                        <div key={dim.key} className={`rounded-2xl border bg-gradient-to-b ${day ? dim.tint : dim.tintDark} p-3 shadow-sm backdrop-blur-sm`}>
                          <div className={`flex items-center gap-1.5 mb-2 font-bold text-xs ${txt}`}>
                            <span className="text-base">{dim.emoji}</span>
                            <span className="uppercase tracking-wider">{dim.label}</span>
                            <span className={`ml-auto text-[9px] ${sub}`}>{lane.length} steps</span>
                          </div>
                          {/* Barriers chips */}
                          {userBarrierLabels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {userBarrierLabels.slice(0, 4).map(b => (
                                <span key={b} className={`text-[8px] px-1.5 py-0.5 rounded-full ${day ? 'bg-white/70 text-slate-600' : 'bg-indigo-900/60 text-indigo-300'} border ${day ? 'border-slate-200' : 'border-indigo-700'}`}>{b}</span>
                              ))}
                            </div>
                          )}
                          {/* Vertical milestone list */}
                          <div className="relative pl-4">
                            {/* lane road */}
                            <div className={`absolute left-1.5 top-2 bottom-2 w-[2px] ${day ? 'bg-slate-300' : 'bg-indigo-700'}`} />
                            {lane.length === 0 && (
                              <div className={`text-[10px] italic ${sub}`}>No milestones yet</div>
                            )}
                            {lane.map((m, i) => (
                              <button
                                key={(m as any).id || i}
                                onClick={() => router.push(`/milestones/${(m as any).id}`)}
                                className={`relative w-full text-left mb-2 p-2 rounded-lg border transition-all hover:shadow-md hover:scale-[1.01] ${m.status === 'active' ? `${day ? 'bg-amber-50 border-amber-400' : 'bg-amber-900/50 border-amber-600'} shadow-sm` : m.status === 'upcoming' ? `${day ? 'bg-white border-slate-200' : 'bg-indigo-950/40 border-indigo-700'}` : `${day ? 'bg-white/60 border-slate-200' : 'bg-indigo-950/30 border-indigo-800'} opacity-70`}`}
                              >
                                {/* node dot on the lane road */}
                                <span className={`absolute -left-[14px] top-3 w-3 h-3 rounded-full ring-2 ${day ? 'ring-white' : 'ring-slate-900'} ${m.status === 'active' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : m.status === 'upcoming' ? (day ? 'bg-sky-400' : 'bg-sky-600') : (day ? 'bg-slate-300' : 'bg-slate-600')}`} />
                                <div className={`flex items-center gap-1 mb-0.5`}>
                                  <span className="text-[10px]">{m.status === 'active' ? '📍' : m.status === 'upcoming' ? '🪧' : '🏁'}</span>
                                  <span className={`text-[9px] font-mono ${sub}`}>Step {i + 1}</span>
                                  {m.status === 'active' && <span className="text-[8px] font-bold text-amber-500 ml-auto">YOU ARE HERE</span>}
                                </div>
                                <div className={`text-[11px] font-bold leading-snug ${txt}`}>{m.name}</div>
                                <div className={`text-[8px] mt-1 ${sub} opacity-0 hover:opacity-100`}>Tap to view →</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className={`text-center text-xs italic ${sub}`}>
                    Generating your dimension roadmaps…
                  </div>
                )}

                {/* Today's schedule below the lanes */}
                <div className="mt-6 max-w-md mx-auto">
                  <div className={`${pill} border rounded-xl overflow-hidden shadow-sm`}>
                    <div className={`flex items-center justify-between px-3 py-2 border-b ${day ? 'border-sky-100' : 'border-indigo-800'}`}>
                      <span className={`text-xs font-bold ${txt}`}>📅 Today</span>
                      <Link href="/calendar" className={`text-[10px] ${day ? 'text-sky-600' : 'text-sky-400'} font-medium`}>Calendar →</Link>
                    </div>
                    {schedule.slice(0, 3).map((s, si) => (
                      <div key={si} className={`flex items-center gap-2 px-3 py-1.5 ${si !== 2 ? `border-b ${day ? 'border-sky-50' : 'border-indigo-800/50'}` : ''}`}>
                        <div className={`text-[10px] font-mono font-bold w-10 ${sub}`}>{s.time}</div>
                        <span className="text-sm">{s.emoji}</span>
                        <div className={`flex-1 ${txt} font-medium text-[11px]`}>{s.task}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
          {/* ═══════════════════════════════
              CURRENT PLACE — character on road
             ═══════════════════════════════ */}
          <div className="w-full">
            {/* Floating clouds */}
            <div className="flex justify-center gap-6 mb-2">
              {[1, 2, 3].map(i => <div key={i} className={`rounded-full blur-sm cf ${day ? 'bg-white/50' : 'bg-indigo-300/10'}`} style={{ width: `${36 + i * 10}px`, height: `${14 + i * 4}px`, animationDelay: `${i * 1.2}s` }} />)}
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center px-2">
              {/* LEFT: Pit Stop Shop (opens ServiceHub) */}
              <div className="flex justify-end">
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
                    <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer" className={`block text-center text-[10px] font-bold mt-2 px-3 py-1.5 rounded-lg shadow transition-all hover:scale-105 ${day ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'}`}>🏪 Open Full Shop →</a>
                  </div>
                </div>
              </div>

              {/* CENTRE: Character + Signboard */}
              <div className="flex flex-col items-center px-2">
                <div className="relative">
                  <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-14 h-5 rounded-full blur-md ${day ? 'bg-white/60' : 'bg-indigo-300/15'}`} />
                  <div className="bn text-5xl">🧑‍🚀</div>
                </div>
                <div className={`text-[10px] font-semibold mt-1 ${sub}`}>📍 You are here</div>
                {/* Signboard for current milestone */}
                <button onClick={() => router.push('/milestones')} className="mt-3 relative group">
                  {/* Post */}
                  <div className={`absolute left-1/2 -translate-x-1/2 -bottom-4 w-2 h-6 ${day ? 'bg-amber-700' : 'bg-amber-900'} rounded-sm`} />
                  {/* Board */}
                  <div className={`sw relative px-4 py-2 rounded-lg shadow-lg border-2 ${day ? 'bg-amber-100 border-amber-600 text-amber-900' : 'bg-amber-900/80 border-amber-600 text-amber-100'}`} style={{ transformOrigin: 'top center' }}>
                    {/* Nails */}
                    <div className={`absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full ${day ? 'bg-amber-500' : 'bg-amber-400'}`} />
                    <div className={`absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full ${day ? 'bg-amber-500' : 'bg-amber-400'}`} />
                    <div className="text-[9px] font-bold uppercase tracking-wider">🪧 Current Milestone</div>
                    <div className={`text-[10px] font-bold mt-0.5 ${day ? 'text-amber-800' : 'text-amber-200'}`}>{milestones[0].name}</div>
                    <div className="text-[8px] opacity-70 mt-0.5 group-hover:underline">Tap to view →</div>
                  </div>
                </button>
                <div className="h-4" />{/* spacer for post */}
              </div>

              {/* RIGHT: Current race info */}
              <div className="flex justify-start">
                <div className={`${pill} border rounded-xl p-2.5 shadow-sm w-full max-w-[180px]`}>
                  <h4 className={`font-bold text-xs mb-1.5 ${txt}`}>🏁 Curr:...</h4>
                  {races.map(r => (
                    <div key={r.id} className="mb-1.5 last:mb-0">
                      <div className={`text-[10px] font-bold ${txt}`}>{r.name}</div>
                      <div className={`h-1 ${day ? 'bg-sky-100' : 'bg-indigo-800'} rounded-full overflow-hidden mt-0.5`}><div className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full" style={{ width: `${r.progress}%` }} /></div>
                      <div className={`text-[8px] ${sub} mt-0.5`}>{r.progress}% · {r.milestone}</div>
                    </div>
                  ))}
                  <div className="flex gap-0.5 flex-wrap mt-1">
                    {races[0].models.map(m => <span key={m} className={`text-[8px] px-1 py-0.5 rounded-full ${day ? 'bg-sky-100 text-sky-700' : 'bg-indigo-800 text-indigo-300'}`}>{m}</span>)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Recommended choices as nodes on the road ─── */}
          {recommendedChoices.map((ch, i) => {
            const isLeft = i % 2 === 0
            return (
              <div key={ch.id} className="w-full max-w-md">
                <RoadDown h={i === 0 ? 40 : 30} />
                <div className={`relative flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                  {/* Choice card */}
                  <Link href={ch.id === 'see' ? '/races' : `/milestones/${ch.id}`}
                    className={`flex-1 p-2.5 rounded-xl border transition-all hover:shadow-md hover:scale-[1.02] ${ch.id === 'see' ? `border-dashed ${pill}` : ch.id === 'cX' ? `${day ? 'bg-indigo-600 border-indigo-600' : 'bg-purple-800 border-purple-600'} text-white shadow-lg` : `${pill} shadow-sm`}`}>
                    <div className={`font-semibold text-[10px] ${ch.id === 'cX' ? 'text-sky-200' : day ? 'text-sky-600' : 'text-sky-400'}`}>{ch.name}</div>
                    {ch.success !== null && <div className={`text-[9px] ${ch.id === 'cX' ? 'text-sky-300' : sub}`}>Success: {ch.success}% · {ch.attempts}</div>}
                  </Link>
                  {/* Connector arm */}
                  <div className={`w-6 h-[3px] ${day ? 'bg-sky-300' : 'bg-indigo-600'}`} />
                  {/* Road node */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md flex-shrink-0 ${ch.id === 'cX' ? 'bg-gradient-to-br from-indigo-500 to-purple-600 ring-2 ring-indigo-300' : ch.id === 'see' ? `${day ? 'bg-slate-100 border-2 border-dashed border-slate-300' : 'bg-indigo-900 border-2 border-dashed border-indigo-600'}` : `${day ? 'bg-sky-100 border-2 border-sky-300' : 'bg-indigo-800 border-2 border-indigo-500'}`}`}>
                    <span className="text-xs">{ch.id === 'see' ? '…' : ch.id === 'cX' ? '⭐' : '🔵'}</span>
                  </div>
                  {/* Connector arm (other side) */}
                  <div className="w-6 h-[3px] bg-transparent" />
                  {/* Empty spacer for symmetry */}
                  <div className="flex-1" />
                </div>
              </div>
            )
          })}

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
        </div>
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
