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

const LABELS: Record<AgentKey, string> = {
  pattern_recognition: 'Pattern Recognition Agent',
  path_planning: 'Path Planning Agent',
  tool_recommendation: 'Tool Recommendation Agent',
  calendar_optimization: 'Calendar Optimization Agent',
  reflection_analysis: 'Reflection Analysis Agent',
  adaptation: 'Adaptation Agent',
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
    return `${slice.recommendations.length} tools recommended for your barriers.`
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

  return (
    <div
      className={
        'flex items-start gap-3 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-cyan-50 px-4 py-3 ' +
        className
      }
    >
      <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
          {LABELS[agent]}
        </p>
        <p className="text-sm text-slate-700">{message}</p>
      </div>
    </div>
  )
}
