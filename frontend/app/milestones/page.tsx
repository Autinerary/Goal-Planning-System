'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { X, Sparkles, Calendar, Heart, Key, Hammer, ArrowUp, SprayCan, Wrench, Shield, Lock, Unlock, ChevronDown, ChevronUp, Star, Bookmark, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'
import { resolveToolLink } from '@/lib/toolLink'
import { goHubHref } from '@/lib/serviceHub'
import { computeRaceProgress, fetchCompletedMilestoneIds, type ProgressMilestone } from '@/lib/raceProgress'
import AgentInsightsBanner from '../components/AgentInsightsBanner'

const SERVICE_HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/**
 * Pull a real ResourceHub resource UUID out of a tool. ServiceHub tools have an
 * id like "sh_<uuid>" and/or a url like ".../resources/<uuid>". Knowledge-base
 * tools have neither, so this returns null and those tools stay local-only.
 */
function extractResourceId(id?: string, url?: string): string | null {
  const fromId = id?.startsWith('sh_') ? id.slice(3) : undefined
  if (fromId && UUID_RE.test(fromId)) return fromId
  const m = (url || '').match(new RegExp(`/resources/(${UUID_RE.source})`, 'i'))
  if (m) return m[1]
  return null
}

/**
 * 1–2 short bullets on how a tool helps with a category (Odosa). Prefers
 * agent-provided points; otherwise derives them from the tool description +
 * category so existing paths still read well.
 */
function deriveHelpBullets(tool: any, categoryName: string): string[] {
  const desc = String(tool?.desc || '').trim()
  const bullets = desc
    .split(/(?<=[.;])\s+/)
    .map((s: string) => s.trim().replace(/[.;]+$/, ''))
    .filter(Boolean)
    .slice(0, 2)
  if (bullets.length === 0) {
    bullets.push(`A recommended ${String(tool?.type || 'tool').toLowerCase()} for this milestone`)
  }
  if (bullets.length === 1) {
    bullets.push(`Chosen to support your ${categoryName || 'needs'} on this step`)
  }
  return bullets.slice(0, 2)
}

export default function MilestoneView() {
  const router = useRouter()
  const { pathPlanning, toolRecommendation, patternRecognition, payload, loading } = useAgentPath()
  const [unlockedBarriers, setUnlockedBarriers] = useState<Set<string>>(new Set(['b1']))
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  // Collapsible Tools/Barriers table (Odosa: dropdown to slim the page).
  const [toolsOpen, setToolsOpen] = useState(true)
  const [showGif, setShowGif] = useState<string | null>(null)
  const [completedMilestoneIds, setCompletedMilestoneIds] = useState<Set<string>>(new Set())
  // Note shown when a tool can't be saved to ResourceHub (not catalogued).
  const [rhNote, setRhNote] = useState<string | null>(null)
  useEffect(() => {
    if (!rhNote) return
    const t = setTimeout(() => setRhNote(null), 4000)
    return () => clearTimeout(t)
  }, [rhNote])

  // Tool status (Odosa): Wishlist vs Currently Using — mirrors ResourceHub's
  // saved_resources status ('wishlist' | 'current'). Persisted locally and
  // synced best-effort to ServiceHub.
  const [toolStatus, setToolStatus] = useState<Record<string, 'wishlist' | 'current'>>(() => {
    if (typeof window !== 'undefined') {
      try { const s = localStorage.getItem('milestoneToolStatus'); return s ? JSON.parse(s) : {} } catch { return {} }
    }
    return {}
  })
  // Barrier effectiveness ratings (Odosa): 5-star rating replaces "Use Tool".
  const [barrierRatings, setBarrierRatings] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try { const s = localStorage.getItem('milestoneBarrierRatings'); return s ? JSON.parse(s) : {} } catch { return {} }
    }
    return {}
  })

  useEffect(() => { try { localStorage.setItem('milestoneToolStatus', JSON.stringify(toolStatus)) } catch {} }, [toolStatus])
  useEffect(() => { try { localStorage.setItem('milestoneBarrierRatings', JSON.stringify(barrierRatings)) } catch {} }, [barrierRatings])

  // Server-persisted saved statuses / ratings keyed by real resource UUID.
  // Loaded on mount so Wishlist/Using and star ratings show as already-set for
  // resources the user has interacted with (in this app or in ResourceHub).
  const [serverStatusByResource, setServerStatusByResource] = useState<Record<string, string>>({})
  const [serverRatingByResource, setServerRatingByResource] = useState<Record<string, number>>({})
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [sRes, rRes] = await Promise.all([
          fetch('/api/me/resource-status', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/me/resource-rating', { cache: 'no-store', credentials: 'include' }),
        ])
        if (!cancelled && sRes.ok) {
          const j = await sRes.json()
          setServerStatusByResource(j?.statuses || {})
        }
        if (!cancelled && rRes.ok) {
          const j = await rRes.json()
          setServerRatingByResource(j?.ratings || {})
        }
      } catch { /* ignore — falls back to local state */ }
    })()
    return () => { cancelled = true }
  }, [])

  // Toggle a tool's ResourceHub status. Best-effort sync to ServiceHub so it
  // shows up in the user's Wishlist / Currently Using lists there too.
  const setToolStatusFor = (tool: any, status: 'wishlist' | 'current') => {
    const toolId = tool.id
    let nextStatus: 'wishlist' | 'current' | null = status
    setToolStatus(prev => {
      const next = { ...prev }
      if (next[toolId] === status) {
        delete next[toolId] // toggle off
        nextStatus = null
      } else {
        next[toolId] = status
      }
      return next
    })
    // Persist to the shared Supabase via our same-origin route. The server
    // resolves the tool to a REAL ResourceHub resource (by id or name) so the
    // save actually shows up in ResourceHub. If the tool isn't catalogued, it
    // tells us so — we revert the optimistic state and show an honest note
    // rather than pretend it was saved (Odosa: wishlist didn't update).
    try {
      fetch('/api/me/resource-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resourceId: tool.resourceId || null, name: tool.name, url: tool.url, status: nextStatus }),
      })
        .then(r => r.json())
        .then(res => {
          if (res && res.ok === false && res.reason === 'not_in_resourcehub' && nextStatus) {
            setToolStatus(prev => {
              const n = { ...prev }
              delete n[toolId]
              return n
            })
            setRhNote(tool.name)
          }
        })
        .catch(() => {})
    } catch { /* ignore */ }
  }

  const rateBarrier = (barrierId: string, stars: number, resourceId?: string | null) => {
    setBarrierRatings(prev => ({ ...prev, [barrierId]: prev[barrierId] === stars ? 0 : stars }))
    // Rating effectiveness also marks the barrier as being worked on / cleared.
    if (!unlockedBarriers.has(barrierId)) unlockBarrier(barrierId)
    // Persist the rating to the shared Supabase when a real resource is paired.
    if (resourceId && stars >= 1) {
      try {
        fetch('/api/me/resource-rating', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ resourceId, score: stars }),
        }).catch(() => {})
      } catch { /* ignore */ }
    }
  }


  // Real milestone completions (race_progress) for computing real progress.
  useEffect(() => {
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
  }, [])

  const toggleLike = (itemId: string) => {
    // (deprecated) hearts removed from Tools per Odosa — kept as no-op guard.
  }

  const unlockBarrier = (barrierId: string) => {
    setShowGif(barrierId)
    setTimeout(() => {
      setUnlockedBarriers(prev => new Set(prev).add(barrierId))
      setTimeout(() => setShowGif(null), 1200)
    }, 600)
  }

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

  /* Tool symbols - keys, hammers, lift, spray boots, etc. */
  const toolSymbols = [
    { emoji: '🔑', name: 'Key', desc: 'Unlocks access barriers' },
    { emoji: '🔨', name: 'Hammer', desc: 'Breaks through blockers' },
    { emoji: '🏋️', name: 'Lift', desc: 'Builds strength over time' },
    { emoji: '👢', name: 'Spray Boots', desc: 'Speeds through obstacles' },
    { emoji: '🔧', name: 'Wrench', desc: 'Fixes broken processes' },
    { emoji: '🛡️', name: 'Shield', desc: 'Protects from setbacks' },
  ]

  // Real tools from the tool-recommendation agent. We flatten the per-milestone
  // map plus the pit-stop bucket and dedupe so the user sees a useful list.
  const symbolForType = (t: string) => {
    const m: Record<string, string> = {
      service: '🔑', product: '👢', commentary: '🏋️', community: '🛡️', tool: '🔧', other: '🔨',
    }
    return m[(t || '').toLowerCase()] || '🔧'
  }
  const flattenAgentTools = (): any[] => {
    if (!toolRecommendation) return []
    const out: any[] = []
    const seen = new Set<string>()
    const push = (t: any, barrierId?: string) => {
      if (!t || !t.id || seen.has(t.id)) return
      seen.add(t.id)
      out.push({
        id: t.id,
        // Real ResourceHub UUID when the tool came from ServiceHub. Falls back
        // to parsing the "sh_<uuid>" id or a /resources/<uuid> url so we can
        // persist Wishlist/Using/ratings server-side.
        resourceId: t.resourceId || extractResourceId(t.id, t.url),
        name: t.name,
        type: (t.type || 'tool').replace(/^./, (c: string) => c.toUpperCase()),
        symbol: symbolForType(t.type),
        barrier: barrierId || 'b1',
        desc: t.description || '',
        url: t.url || '#',
      })
    }
    const recs = toolRecommendation.recommendations || {}
    const milestoneKeys = Object.keys(recs)
    milestoneKeys.forEach((mk, idx) => {
      const barrierId = `b${(idx % 5) + 1}`
      ;(recs[mk] || []).forEach((t: any) => push(t, barrierId))
    })
    const pit = toolRecommendation.pit_stop_tools || {}
    Object.values(pit).forEach((arr: any) => (arr || []).forEach((t: any) => push(t)))
    return out
  }
  const agentTools = flattenAgentTools()
  // Real agent-recommended tools only — no demo fallback. Empty renders a state.
  const tools = agentTools.slice(0, 8)

  // Real barriers from the user profile (challenges and barrier types).
  const profileBarriers: string[] = [
    ...((payload?.userProfile?.currentChallenges || []) as string[]),
    ...((payload?.userProfile?.barrierTypes || []) as string[]),
  ].filter(Boolean)
  const agentBarriers = profileBarriers.length
    ? profileBarriers.slice(0, 6).map((name, idx) => ({
        id: `b${idx + 1}`,
        name,
        severity: ((idx % 3) + 1) as 1 | 2 | 3,
        unlocked: idx === 0,
      }))
    : null
  // Real barriers from the user's profile only — no demo fallback.
  const barriers = agentBarriers || []

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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center bg-gradient-to-b from-amber-50 to-amber-100">
        <div className="text-5xl">🪧</div>
        <h1 className="text-xl font-bold text-slate-800">No milestones yet</h1>
        <p className="text-sm text-slate-500 max-w-sm">
          Your milestones appear here once your path is generated. Complete onboarding to build one.
        </p>
        <Link href="/onboarding" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:shadow-lg transition-all">
          Go to onboarding →
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100">
      {/* ResourceHub note — shown when a tool isn't a catalogued resource */}
      {rhNote && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm bg-slate-800 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-start gap-2">
          <Bookmark className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-300" />
          <span>“{rhNote}” isn’t in ResourceHub yet, so it can’t be added to your list. It’s noted here only.</span>
        </div>
      )}
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-3">
        <AgentInsightsBanner agent="path_planning" />
        <AgentInsightsBanner agent="pattern_recognition" />
        <a
          href={goHubHref('/community?from=hare-world&context=milestones')}
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
        >
          <div className="relative overflow-hidden rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-4 shadow-sm transition-all hover:shadow-md hover:border-emerald-400">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
                      Tidbits
                    </span>
                    <span className="text-sm font-bold text-slate-800">Stuck on a barrier?</span>
                  </div>
                  <p className="text-xs text-slate-600">Ask the community — read insights from people who&apos;ve overcome the same blockers.</p>
                </div>
              </div>
              <span className="hidden sm:block text-xs font-semibold text-emerald-700 group-hover:underline whitespace-nowrap">
                Open Tidbits →
              </span>
            </div>
          </div>
        </a>
      </div>
      {/* Wooden signpost header */}
      <div className="relative">
        <div className="max-w-4xl mx-auto px-4 pt-6 pb-4">
          {/* Close button */}
          <button onClick={() => router.back()} className="absolute top-4 right-4 p-2 bg-white/80 rounded-full hover:bg-white shadow-sm z-10">
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
                <h1 className="text-2xl font-bold text-amber-900 text-center">🪧 Milestone View</h1>
                <p className="text-amber-700 text-sm text-center mt-1">{races[0].name} — Race 1</p>
              </div>
            </div>
            {/* Post */}
            <div className="w-3 h-8 bg-amber-800 rounded-b" />
          </div>

          {/* Progress bar — game style, getting BIGGER */}
          <div className="mt-4 max-w-md mx-auto">
            <div className="flex justify-between text-xs font-bold text-amber-800 mb-1">
              <span>Progress: {races[0].progress}%</span>
              <span>🏁 Finish</span>
            </div>
            <div className="relative h-6 bg-amber-200 rounded-full border-2 border-amber-600 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 rounded-full transition-all duration-1000 relative"
                style={{ width: `${races[0].progress}%`, animation: 'barGrow 1.5s ease-out' }}
              >
                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-sm">🧑‍🚀</div>
              </div>
              {/* Level markers */}
              {[25, 50, 75].map(p => (
                <div key={p} className="absolute top-0 bottom-0 w-0.5 bg-amber-600/30" style={{ left: `${p}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-amber-600 mt-0.5">
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
        <div className="mb-4 bg-white/80 backdrop-blur border-2 border-amber-300 rounded-2xl p-4 shadow-md">
          <h3 className="font-bold text-amber-900 mb-1 flex items-center gap-2">📋 Summary</h3>
          <p className="text-sm text-slate-600">Current Milestone: <strong>{pathPlanning?.milestones?.[0]?.name || races[0]?.name || 'Your current milestone'}</strong></p>
          <p className="text-sm text-slate-500 mt-1">Each individual task is YOU using TOOLS to REMOVE BARRIERS. Choose your tools wisely — barriers get bigger but so do you!</p>
        </div>

        {/* Tools to Use — each tool shows what it helps with (Odosa redesign) */}
        <div className="bg-white/80 backdrop-blur border-2 border-amber-300 rounded-2xl overflow-hidden shadow-md">
          {/* Collapsible toggle — lets users slim the page (Odosa: dropdown) */}
          <button
            type="button"
            onClick={() => setToolsOpen(o => !o)}
            aria-expanded={toolsOpen}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border-b border-amber-200 transition-colors"
          >
            <span className="font-bold text-amber-900 flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4" /> Tools to Use
            </span>
            <span className="flex items-center gap-2 text-xs text-amber-700">
              <span>{tools.length} {tools.length === 1 ? 'tool' : 'tools'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {toolsOpen && (<>
          {/* Single full-width header */}
          <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Wrench className="w-5 h-5" /> Tools to Use</h2>
            <p className="text-amber-100 text-xs">Each tool shows what it helps with — add the ones that fit and rate how well they work.</p>
          </div>

          {/* Tool symbol legend (spans both columns) */}
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex flex-wrap gap-2">
            {toolSymbols.map((ts, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <span>{ts.emoji}</span><span className="font-medium">{ts.name}</span>
              </div>
            ))}
          </div>

          {/* Full-width tool cards — each shows what it helps with (Odosa) */}
          {tools.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No tools yet for this milestone — they’ll appear once the AI finishes recommending resources.
            </div>
          )}
          <div className="divide-y divide-amber-100">
            {tools.map((tool: any) => {
              const status = toolStatus[tool.id] || (tool.resourceId ? serverStatusByResource[tool.resourceId] : undefined)
              const rating = barrierRatings[tool.barrier] || (tool.resourceId ? serverRatingByResource[tool.resourceId] : 0) || 0
              const category = barriers.find((b: any) => b.id === tool.barrier)
              const categoryName = category?.name || 'General support'
              // Agent-provided per-category help, else a client-derived fallback.
              const helpGroups: { category: string; points: string[] }[] =
                Array.isArray(tool.helpsWith) && tool.helpsWith.length
                  ? tool.helpsWith.map((h: any) => ({
                      category: String(h.category || categoryName),
                      points: (Array.isArray(h.points) ? h.points : []).map((x: any) => String(x)).filter(Boolean).slice(0, 2),
                    }))
                  : [{ category: categoryName, points: deriveHelpBullets(tool, categoryName) }]
              return (
                <div key={tool.id} className="p-4">
                  <div className={`rounded-xl border-2 p-4 transition-all ${status ? 'bg-green-50 border-green-300' : 'bg-white border-amber-200'}`}>
                    {/* Tool header */}
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{tool.symbol}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800">{tool.name}</div>
                        <div className="text-xs text-slate-500">{tool.type}</div>
                      </div>
                    </div>

                    {/* What this helps with */}
                    <div className="mt-3 rounded-lg bg-amber-50/70 border border-amber-100 p-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">What this helps with</div>
                      <div className="space-y-2.5">
                        {helpGroups.map((g, gi) => (
                          <div key={gi}>
                            <div className="text-sm font-semibold text-slate-800">Category: {g.category}</div>
                            <ul className="mt-1 space-y-0.5">
                              {g.points.map((pt, pi) => (
                                <li key={pi} className="text-xs text-slate-600 flex gap-1.5">
                                  <span className="text-amber-500 flex-shrink-0">•</span><span>{pt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Wishlist / Currently Using + open */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <button
                        onClick={() => setToolStatusFor(tool, 'wishlist')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${status === 'wishlist' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-300 hover:bg-amber-50'}`}
                      >
                        <Bookmark className="w-3 h-3" /> Wishlist
                      </button>
                      <button
                        onClick={() => setToolStatusFor(tool, 'current')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${status === 'current' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-600 border-green-300 hover:bg-green-50'}`}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Currently Using
                      </button>
                      <a href={resolveToolLink(tool.url, tool.name).href} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-sky-600 hover:underline inline-flex items-center gap-1">
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Effectiveness rating (kept; severity removed per Odosa) */}
                    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-amber-100">
                      <span className="text-[11px] font-semibold text-slate-500 mr-1">How well did it help?</span>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => rateBarrier(tool.barrier, star, tool.resourceId)} className="p-0.5" title={`${star} star${star > 1 ? 's' : ''}`}>
                          <Star className={`w-4 h-4 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Progress — categories your rated tools address */}
          <div className="px-4 py-3 bg-amber-50/60 border-t border-amber-200">
            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
              <span>Categories addressed</span>
              <span>{unlockedBarriers.size}/{barriers.length}</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all" style={{ width: `${(unlockedBarriers.size / Math.max(barriers.length, 1)) * 100}%` }} />
            </div>
          </div>
          </>)}
        </div>

        {/* View all resources & ResourceHub (Odosa) */}
        <div className="mt-4 flex justify-center">
          <a
            href={goHubHref('/')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium text-sm hover:shadow-lg transition-all"
          >
            <ExternalLink className="w-4 h-4" /> View all resources &amp; ResourceHub
          </a>
        </div>

        {/* Could add gifs of barriers being unlocked */}
        {showGif && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-center" style={{ animation: 'unlockPop 1s ease-out' }}>
              <div className="text-8xl mb-2">🔓</div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">Barrier Unlocked!</div>
            </div>
          </div>
        )}

        {/* Footer navigation */}
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/reflection?contextType=milestone" className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium text-sm hover:shadow-lg transition-all flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Journal / Reflection
          </Link>
          <Link href="/calendar" className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-xl font-medium text-sm hover:shadow-lg transition-all flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Calendar
          </Link>
        </div>
      </div>
    </div>
  )
}
