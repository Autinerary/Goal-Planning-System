'use client'

import NoPlanYet from '../components/NoPlanYet'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { X, Sparkles, Calendar, Wrench, ChevronDown, Loader2, Users, MessageCircle, ClipboardList, Flag } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'
import { goHubHref } from '@/lib/serviceHub'
import { computeRaceProgress, fetchCompletedMilestoneIds, type ProgressMilestone } from '@/lib/raceProgress'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import MilestoneTools, { HubButton } from '../components/MilestoneTools'
import TopMistakes from '../components/TopMistakes'
import { toolsFromRecs, type PlanTool } from '@/lib/milestoneTools'
import { guidanceFor } from '@/lib/guidanceData'
import { useMilestoneGuidance } from '@/lib/useMilestoneGuidance'

function MilestoneView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { pathPlanning, toolRecommendation, payload, loading } = useAgentPath()
  // The norms a used tool helped with, from its "What this helps with".
  const [unlockedBarriers, setUnlockedBarriers] = useState<Set<string>>(new Set())
  // Collapsible Tools/Barriers table (Odosa: dropdown to slim the page).
  // Starts CLOSED so the page reads slim by default (Odosa follow-up).
  const [toolsOpen, setToolsOpen] = useState(false)
  const [showGif, setShowGif] = useState<string | null>(null)
  const [completedMilestoneIds, setCompletedMilestoneIds] = useState<Set<string>>(new Set())
  const [completedLoaded, setCompletedLoaded] = useState(false)

  // Real milestone completions (race_progress) for computing real progress.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const ids = await fetchCompletedMilestoneIds()
      if (!cancelled) { setCompletedMilestoneIds(ids); setCompletedLoaded(true) }
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
  }, [])

  const unlockBarrier = (barrierId: string) => {
    setShowGif(barrierId)
    setTimeout(() => {
      setUnlockedBarriers(prev => new Set(prev).add(barrierId))
      setTimeout(() => setShowGif(null), 1200)
    }, 600)
  }

  // Which milestone this page is about: the one asked for (?m=), else the
  // first one not finished yet. It used to show the plan's first milestone
  // whatever was done, and every tool from every milestone mixed together.
  const planMilestoneList: any[] = (pathPlanning?.milestones || []) as any[]
  const chosenId = searchParams.get('m')
  const currentMilestone: any =
    planMilestoneList.find((m) => m.id === chosenId) ||
    planMilestoneList.find((m) => !completedMilestoneIds.has(m.id)) ||
    planMilestoneList[planMilestoneList.length - 1] ||
    null
  const currentName: string = currentMilestone?.name || currentMilestone?.title || ''
  const baseTools: PlanTool[] = currentMilestone ? toolsFromRecs((toolRecommendation?.recommendations || {})[currentMilestone.id]) : []
  const { guidance, loading: guidanceLoading, failed: guidanceFailed } = useMilestoneGuidance(
    payload as any,
    currentMilestone ? [{ id: currentMilestone.id, name: currentName }] : [],
  )

  // Real races derived from agent payload (fallback to mock).
  const agentRaces = payload?.races?.length
    ? payload.races.map((r: any, idx: number) => ({
        id: r.id || `race_${idx + 1}`,
        name: r.name || r.goal || `Goal ${idx + 1}`,
        progress: typeof r.progress === 'number' ? r.progress : 0,
      }))
    : (payload?.userProfile?.goals as string[] | undefined)?.map((g: string, idx: number) => ({
        id: `race_${idx + 1}`,
        name: g,
        progress: 0,
      })) || []
  // Override with real progress: % of each race's milestones completed.
  const _pathMilestones: ProgressMilestone[] =
    (payload?.milestones || pathPlanning?.milestones || []) as ProgressMilestone[]
  agentRaces.forEach((r: any) => {
    const p = computeRaceProgress(r, _pathMilestones, completedMilestoneIds)
    if (p !== null) r.progress = p
  })
  const races = agentRaces
  const raceIndex = Math.max(0, races.findIndex((r: any) => r.id === currentMilestone?.raceId || r.name === currentMilestone?.goal))
  const race = races[raceIndex] || races[0]

  /* Tool symbols - keys, hammers, lift, spray boots, etc. */
  const toolSymbols = [
    { emoji: '🔑', name: 'Key', desc: 'Unlocks access' },
    { emoji: '🔨', name: 'Hammer', desc: 'Breaks through blockers' },
    { emoji: '🏋️', name: 'Lift', desc: 'Builds strength over time' },
    { emoji: '👢', name: 'Spray Boots', desc: 'Speeds through obstacles' },
    { emoji: '🔧', name: 'Wrench', desc: 'Fixes broken processes' },
    { emoji: '🛡️', name: 'Shield', desc: 'Protects from setbacks' },
  ]

  // Real barriers from the user profile (challenges and barrier types).
  const profileBarriers: string[] = [
    ...((payload?.userProfile?.currentChallenges || []) as string[]),
    ...((payload?.userProfile?.barrierTypes || []) as string[]),
  ].filter(Boolean)
  // Real barriers from the user's profile only — no demo fallback.
  const barriers = profileBarriers.slice(0, 6).map((name, idx) => ({ id: `b${idx + 1}`, name }))
  // Rating a used tool marks the norms it helped with (its "What this helps
  // with", from the agent) as addressed. Nothing is marked on no evidence.
  const onRated = (tool: PlanTool) => {
    const helped = new Set((tool.helpsWith || []).map((h) => String(h.category || '').trim().toLowerCase()))
    for (const b of barriers) if (helped.has(b.name.trim().toLowerCase()) && !unlockedBarriers.has(b.id)) unlockBarrier(b.id)
  }

  // No demo data: show honest loading / empty states instead.
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-amber-50 to-amber-100">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm text-slate-500">Loading your milestone…</p>
      </div>
    )
  }
  if (races.length === 0) {
    return <NoPlanYet what="Every small step of your plan is listed here" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100">
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-3">
        <AgentInsightsBanner agent="path_planning" />
        <AgentInsightsBanner agent="pattern_recognition" />
        {/* Stuck? — three ways to get help (Odosa): make a Tidbit, ask a
            mentor/role model, or ask the assistant. */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800">Stuck on something?</span>
              <p className="text-xs text-slate-600">Get help three ways: from the community, a role model, or the assistant.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* 1 — Make a Tidbit (opens the community composer in ResourceHub) */}
            <a
              href={goHubHref('/community/new?from=milestones')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-800">Make a Tidbit</span>
            </a>
            {/* 2 — Ask a mentor / role model (Hare World) */}
            <Link
              href="/hare-world"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-purple-200 hover:border-purple-400 hover:shadow-sm transition-all"
            >
              <Users className="w-4 h-4 text-purple-600 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-800">Ask a mentor / role model</span>
            </Link>
            {/* 3 — Ask the assistant (AI chatbot) */}
            <Link
              href="/assistant"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-sky-200 hover:border-sky-400 hover:shadow-sm transition-all"
            >
              <MessageCircle className="w-4 h-4 text-sky-600 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-800">Ask the assistant</span>
            </Link>
          </div>
        </div>
      </div>
      {/* Wooden signpost header */}
      <div className="relative">
        <div className="max-w-4xl mx-auto px-4 pt-6 pb-4">
          {/* Close button */}
          <button onClick={() => router.back()} aria-label="Close" className="absolute top-4 right-4 p-2 bg-white/80 rounded-full hover:bg-white shadow-sm z-10">
            <X className="w-5 h-5 text-slate-600" />
          </button>

          {/* Sign post structure */}
          <div className="flex flex-col items-center">
            {/* Hanging sign */}
            <div className="relative">
              {/* Rope/chains */}
              <div className="flex justify-center gap-32 mb-1">
                <div className="w-1 h-4 bg-amber-700 rounded-full" />
                <div className="w-1 h-4 bg-amber-700 rounded-full" />
              </div>
              <div className="bg-gradient-to-b from-amber-200 to-amber-300 border-4 border-amber-700 rounded-xl px-8 py-4 shadow-lg" style={{ animation: 'signSwing 4s ease-in-out infinite', transformOrigin: 'top center' }}>
                <style>{`@keyframes signSwing{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(1deg)}} @keyframes unlockPop{0%{transform:scale(1)}30%{transform:scale(1.3)}60%{transform:scale(0.9)}100%{transform:scale(1)}} @keyframes shatter{0%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.2)}100%{opacity:0;transform:scale(0) rotate(180deg)}} @keyframes barGrow{from{width:0}}`}</style>
                {/* Nails */}
                <div className="absolute top-2 left-3 w-2 h-2 rounded-full bg-amber-600" />
                <div className="absolute top-2 right-3 w-2 h-2 rounded-full bg-amber-600" />
                <h1 className="text-2xl font-bold text-amber-900 text-center flex items-center justify-center gap-2"><Flag className="w-6 h-6" aria-hidden="true" />Milestone View</h1>
                <p className="text-amber-800 text-sm text-center mt-1">{race?.name}: Race {raceIndex + 1}</p>
              </div>
            </div>
            {/* Post */}
            <div className="w-3 h-8 bg-amber-800 rounded-b" />
          </div>

          {/* Progress bar — game style, getting BIGGER */}
          <div className="mt-4 max-w-md mx-auto">
            <div className="flex justify-between text-xs font-bold text-amber-800 mb-1">
              <span>Progress: {race?.progress ?? 0}%</span>
              <span>🏁 Finish</span>
            </div>
            <div className="relative h-6 bg-amber-200 rounded-full border-2 border-amber-600 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 rounded-full transition-all duration-1000 relative"
                style={{ width: `${race?.progress ?? 0}%`, animation: 'barGrow 1.5s ease-out' }}
              >
                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-sm">🧑‍🚀</div>
              </div>
              {/* Level markers */}
              {[25, 50, 75].map(p => (
                <div key={p} className="absolute top-0 bottom-0 w-0.5 bg-amber-600/30" style={{ left: `${p}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-[0.5625rem] text-amber-600 mt-0.5">
              {['Start', 'Lv 1', 'Lv 2', 'Lv 3', 'Dream'].map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content: Summary + unified Tools/Barriers table */}
      <div className="max-w-4xl mx-auto px-4 pb-8">

        {/* Summary — moved to just below the progress bar (Odosa) */}
        <div className="mb-4 border border-amber-300 rounded-2xl p-4 surface">
          <h3 className="font-bold text-amber-900 mb-1 flex items-center gap-2"><ClipboardList className="w-4 h-4" aria-hidden="true" />Summary</h3>
          <p className="text-sm text-slate-700">{currentMilestone && !completedMilestoneIds.has(currentMilestone.id) ? 'Current milestone' : 'Milestone'}: <strong>{currentName || 'Your current milestone'}</strong></p>
          <p className="text-sm text-slate-600 mt-1">Each task is you using tools to move forward. Choose your tools wisely. Steps get bigger, but so do you!</p>
          {planMilestoneList.length > 1 && (
            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-800">
              <span className="font-semibold">Show another milestone</span>
              <select
                value={currentMilestone?.id || ''}
                onChange={(e) => router.replace(`/milestones?m=${encodeURIComponent(e.target.value)}`)}
                className="max-w-full rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm"
              >
                {planMilestoneList.map((m: any, i: number) => (
                  <option key={m.id} value={m.id}>{`${i + 1}. ${m.name || m.title}${completedMilestoneIds.has(m.id) ? ' (done)' : ''}`}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* What NOT to do, as strongly as the tools (the team's notes):
            the same five as this step's Avoidance in the Race view. */}
        {currentMilestone && (
          <TopMistakes
            className="mb-4"
            milestoneId={currentMilestone.id}
            guidance={guidanceFor(guidance, currentMilestone.id, currentName)}
            loading={guidanceLoading}
            failed={guidanceFailed}
          />
        )}

        {/* Recommended Tools to use: this milestone's (the team's notes). */}
        <div className="border border-amber-300 rounded-2xl overflow-hidden surface">
          {/* Collapsible toggle — lets users slim the page (Odosa: dropdown) */}
          <button
            type="button"
            onClick={() => setToolsOpen(o => !o)}
            aria-expanded={toolsOpen}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border-b border-amber-200 transition-colors"
          >
            <span className="font-bold text-amber-900 flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4" aria-hidden="true" /> Recommended Tools to use
            </span>
            <span className="flex items-center gap-2 text-xs text-amber-800">
              <ChevronDown className={`w-4 h-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </span>
          </button>
          {toolsOpen && (<>
          {/* Tool symbol legend */}
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex flex-wrap gap-2">
            {toolSymbols.map((ts, i) => (
              <div key={i} className="flex items-center gap-1 text-[0.625rem] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                <span aria-hidden="true">{ts.emoji}</span><span className="font-medium">{ts.name}</span>
              </div>
            ))}
          </div>

          <div className="p-4">
            {currentMilestone && completedLoaded ? (
              <MilestoneTools
                milestoneId={currentMilestone.id}
                milestoneName={currentName}
                baseTools={baseTools}
                initialEdits={(payload as any)?.toolEdits?.[currentMilestone.id]}
                onRated={onRated}
                hubButton={false}
              />
            ) : (
              <p className="py-6 text-center text-sm text-slate-700">{currentMilestone ? 'Loading this milestone’s tools…' : 'No milestones in your plan yet.'}</p>
            )}
          </div>

          {/* Progress — the norms your used, rated tools helped with */}
          <div className="px-4 py-3 bg-amber-50/60 border-t border-amber-200">
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Categories addressed</span>
              <span>{unlockedBarriers.size}/{barriers.length}</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all" style={{ width: `${(unlockedBarriers.size / Math.max(barriers.length, 1)) * 100}%` }} />
            </div>
          </div>
          </>)}
        </div>

        {/* "View these resources & more in ResourceHub" (the team's notes) */}
        <div className="mt-4 flex justify-center">
          <HubButton milestoneName={currentName} />
        </div>

        {/* Could add gifs of barriers being unlocked */}
        {showGif && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-center" style={{ animation: 'unlockPop 1s ease-out' }}>
              <div className="text-8xl mb-2">🔓</div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">Norm Unlocked!</div>
            </div>
          </div>
        )}

        {/* Footer navigation */}
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/reflection?contextType=milestone" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-medium text-sm hover:shadow-lg transition-all flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Journal / Reflection
          </Link>
          <Link href="/calendar" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-medium text-sm hover:shadow-lg transition-all flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Calendar
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function MilestoneViewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-lg">Loading your milestone…</div>}>
      <MilestoneView />
    </Suspense>
  )
}
