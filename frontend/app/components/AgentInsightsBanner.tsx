'use client'

/**
 * Small banner that surfaces an AI agent's output (explanation/insight)
 * on any page. Renders nothing when the agent has no data, so pages stay
 * clean in fallback / signed-out states.
 */

import { Sparkles } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'

type AgentKey =
  | 'pattern_recognition'
  | 'path_planning'
  | 'tool_recommendation'
  | 'calendar_optimization'
  | 'reflection_analysis'
  | 'adaptation'

/**
 * What the reader is being told, in their words rather than ours.
 *
 * These used to read "CALENDAR OPTIMIZATION AGENT" and so on. A tester's
 * note was that the banner is "unnecessary to display to the user unless it
 * is done manually" — and they were looking at a paragraph beginning "I
 * thoughtfully structured your week...", which announces an automatic
 * action nobody asked about and names an internal component while doing it.
 * Which agent produced a sentence is our architecture, not their business.
 */
const LABELS: Record<AgentKey, string> = {
  pattern_recognition: 'Why we suggested this',
  path_planning: 'How your path was built',
  tool_recommendation: 'Why these tools',
  calendar_optimization: 'Why your week looks like this',
  reflection_analysis: 'What we noticed',
  adaptation: 'What changed and why',
}

function extractMessage(slice: any): string | null {
  if (!slice) return null
  if (typeof slice.explanation === 'string' && slice.explanation.trim()) return slice.explanation
  if (typeof slice.summary === 'string' && slice.summary.trim()) return slice.summary
  if (typeof slice.insight === 'string' && slice.insight.trim()) return slice.insight
  if (Array.isArray(slice.patterns) && slice.patterns.length) {
    const p = slice.patterns[0]
    return p?.insight || p?.description || `${slice.patterns.length} similar patterns found`
  }
  if (Array.isArray(slice.recommendations) && slice.recommendations.length) {
    return `${slice.recommendations.length} tools recommended for the barriers you face.`
  }
  if (typeof slice.confidence === 'number') {
    return `Confidence: ${Math.round(slice.confidence * 100)}%`
  }
  return null
}

export default function AgentInsightsBanner({
  agent,
  fallback,
  className = '',
}: {
  agent: AgentKey
  fallback?: string
  className?: string
}) {
  const ctx = useAgentPath()
  const sliceMap: Record<AgentKey, any> = {
    pattern_recognition: ctx.patternRecognition,
    path_planning: ctx.pathPlanning,
    tool_recommendation: ctx.toolRecommendation,
    calendar_optimization: ctx.calendarOptimization,
    reflection_analysis: ctx.reflectionAnalysis,
    adaptation: ctx.adaptation,
  }
  const slice = sliceMap[agent]
  const message = extractMessage(slice) || fallback
  if (!message) return null

  // Collapsed by default. The explanation stays reachable, because an app
  // that rearranges someone's week owes them a reason it can show on
  // request, but it no longer occupies the top of the page uninvited.
  return (
    <details
      className={
        'group rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-cyan-50 ' +
        className
      }
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-xs font-medium text-purple-700">
        <Sparkles className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        {LABELS[agent]}
        <span className="ml-auto text-purple-400 group-open:hidden">Show</span>
        <span className="ml-auto hidden text-purple-400 group-open:inline">Hide</span>
      </summary>
      <p className="border-t border-purple-100 px-4 py-3 text-sm text-slate-700">{message}</p>
    </details>
  )
}
