'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { X, Sparkles, Calendar, Heart, Key, Hammer, ArrowUp, SprayCan, Wrench, Shield, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'
import AgentInsightsBanner from '../components/AgentInsightsBanner'

const SERVICE_HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'

export default function MilestoneView() {
  const router = useRouter()
  const { pathPlanning, toolRecommendation, patternRecognition, payload } = useAgentPath()
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set())
  const [unlockedBarriers, setUnlockedBarriers] = useState<Set<string>>(new Set(['b1']))
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  const [showGif, setShowGif] = useState<string | null>(null)

  const toggleLike = (itemId: string) => {
    setLikedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) { newSet.delete(itemId) } else { newSet.add(itemId) }
      return newSet
    })
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
      })) || [
        { id: 'race_1', name: 'Graduate University', progress: 45 },
        { id: 'race_2', name: 'Get Tech Job', progress: 20 },
      ]
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
  const tools = agentTools.length
    ? agentTools.slice(0, 8)
    : [
        { id: 't1', name: 'Disability Office', type: 'Service', symbol: '🔑', barrier: 'b1', desc: 'Access accommodations', url: '#' },
        { id: 't2', name: 'Academic Advisor', type: 'Service', symbol: '🔧', barrier: 'b2', desc: 'Plan your path', url: '#' },
        { id: 't3', name: '"Accommodation Guide" video', type: 'Commentary', symbol: '🏋️', barrier: 'b3', desc: 'Learn the process', url: '#' },
        { id: 't4', name: 'Tiimo App', type: 'Product', symbol: '👢', barrier: 'b4', desc: 'ADHD-friendly planner', url: '#' },
        { id: 't5', name: 'Study Group (online)', type: 'Other', symbol: '🛡️', barrier: 'b5', desc: 'Peer accountability', url: '#' },
        { id: 't6', name: 'Notion Templates', type: 'Product', symbol: '🔨', barrier: 'b3', desc: 'Organize everything', url: '#' },
      ]

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
  const barriers = agentBarriers || [
    { id: 'b1', name: 'Don\'t know where to start', severity: 1, unlocked: true },
    { id: 'b2', name: 'Overwhelmed by paperwork', severity: 2, unlocked: false },
    { id: 'b3', name: 'Fear of disclosure', severity: 3, unlocked: false },
    { id: 'b4', name: 'Time management struggles', severity: 2, unlocked: false },
    { id: 'b5', name: 'Social anxiety in groups', severity: 3, unlocked: false },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100">
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-3">
        <AgentInsightsBanner agent="path_planning" />
        <AgentInsightsBanner agent="pattern_recognition" />
        <a
          href={`${SERVICE_HUB_URL.replace(/\/$/, '')}/community?from=hare-world&context=milestones`}
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

      {/* Main content: Tools to Use | Barriers Unlocked */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <div className="grid md:grid-cols-2 gap-4">

          {/* LEFT: Tools to Use */}
          <div className="bg-white/80 backdrop-blur border-2 border-amber-300 rounded-2xl overflow-hidden shadow-md">
            <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5" /> Tools to Use
              </h2>
              <p className="text-amber-100 text-xs">Choose your tools to remove barriers</p>
            </div>

            {/* Tool symbol legend */}
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex flex-wrap gap-2">
              {toolSymbols.map((ts, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  <span>{ts.emoji}</span>
                  <span className="font-medium">{ts.name}</span>
                </div>
              ))}
            </div>

            <div className="p-3 space-y-2">
              {tools.map(tool => {
                const isUnlocked = unlockedBarriers.has(tool.barrier)
                return (
                  <button
                    key={tool.id}
                    onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all hover:shadow-md ${isUnlocked ? 'bg-green-50 border-green-300' : 'bg-white border-amber-200 hover:border-amber-400'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{tool.symbol}</span>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-slate-800">{tool.name}</div>
                        <div className="text-xs text-slate-500">{tool.type} · {tool.desc}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isUnlocked && <span className="text-green-500 text-xs font-bold">✓ Used</span>}
                        <button
                          onClick={e => { e.stopPropagation(); toggleLike(tool.id) }}
                          className={`p-1 rounded-full transition-colors ${likedItems.has(tool.id) ? 'text-red-500' : 'text-slate-300 hover:text-red-400'}`}
                        >
                          <Heart className={`w-4 h-4 ${likedItems.has(tool.id) ? 'fill-red-500' : ''}`} />
                        </button>
                      </div>
                    </div>
                    {expandedTool === tool.id && (
                      <div className="mt-2 pt-2 border-t border-amber-100 text-xs text-slate-600">
                        <p>→ Targets barrier: <strong>{barriers.find(b => b.id === tool.barrier)?.name}</strong></p>
                        <a href={tool.url} className="text-sky-600 hover:underline mt-1 block">Open resource →</a>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* RIGHT: Barriers — Getting BIGGER each time */}
          <div className="bg-white/80 backdrop-blur border-2 border-red-200 rounded-2xl overflow-hidden shadow-md">
            <div className="bg-gradient-to-r from-red-400 to-rose-500 px-4 py-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5" /> Barriers to Unlock
              </h2>
              <p className="text-red-100 text-xs">Getting bigger each time — break them down!</p>
            </div>

            <div className="p-3 space-y-3">
              {barriers.map((barrier, idx) => {
                const isUnlocked = unlockedBarriers.has(barrier.id)
                const isAnimating = showGif === barrier.id
                /* Bars get BIGGER with severity */
                const barHeight = 40 + barrier.severity * 16
                return (
                  <div key={barrier.id} className="relative">
                    {/* Barrier block — grows with severity */}
                    <div
                      className={`relative rounded-xl border-2 transition-all duration-500 overflow-hidden ${isUnlocked ? 'border-green-300 bg-green-50' : 'border-red-300 bg-gradient-to-r from-red-50 to-rose-50'} ${isAnimating ? 'animate-pulse' : ''}`}
                      style={{ minHeight: barHeight }}
                    >
                      {/* Shatter effect when unlocking */}
                      {isAnimating && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <div className="text-4xl" style={{ animation: 'unlockPop 0.6s ease-out' }}>🔓</div>
                        </div>
                      )}

                      <div className="p-3 flex items-center gap-3">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${isUnlocked ? 'bg-green-200' : 'bg-red-200'}`}>
                          {isUnlocked ? <Unlock className="w-5 h-5 text-green-600" /> : <Lock className="w-5 h-5 text-red-600" />}
                        </div>
                        <div className="flex-1">
                          <div className={`font-bold text-sm ${isUnlocked ? 'text-green-700 line-through' : 'text-red-800'}`}>
                            {barrier.name}
                          </div>
                          {/* Game bar — highlighted, gets bigger */}
                          <div className={`mt-1 rounded-full overflow-hidden ${isUnlocked ? 'bg-green-200' : 'bg-red-200'}`} style={{ height: 6 + barrier.severity * 3 }}>
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${isUnlocked ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-rose-500'}`}
                              style={{ width: isUnlocked ? '100%' : `${barrier.severity * 25}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-slate-500">Severity: {'🔥'.repeat(barrier.severity)}</span>
                            {isUnlocked && <span className="text-[9px] text-green-600 font-bold">CLEARED!</span>}
                          </div>
                        </div>
                        {!isUnlocked && (
                          <button
                            onClick={() => unlockBarrier(barrier.id)}
                            className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-lg shadow hover:scale-105 transition-all"
                          >
                            Use Tool
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Unlock progress */}
            <div className="px-4 pb-4">
              <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                <span>Barriers Cleared</span>
                <span>{unlockedBarriers.size}/{barriers.length}</span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all" style={{ width: `${(unlockedBarriers.size / barriers.length) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Summary section */}
        <div className="mt-6 bg-white/80 backdrop-blur border-2 border-amber-300 rounded-2xl p-4 shadow-md">
          <h3 className="font-bold text-amber-900 mb-2">📋 Summary</h3>
          <p className="text-sm text-slate-600">Current Milestone: <strong>{pathPlanning?.milestones?.[0]?.name || 'Request accommodations for classes.'}</strong></p>
          <p className="text-sm text-slate-500 mt-1">Each individual task is YOU using TOOLS to REMOVE BARRIERS. Choose your tools wisely — barriers get bigger but so do you!</p>
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
