// What an agent's insight banner says (app/components/AgentInsightsBanner.tsx).
// Pure, so it can be tested.

export type AgentKey =
  | 'pattern_recognition'
  | 'path_planning'
  | 'tool_recommendation'
  | 'calendar_optimization'
  | 'reflection_analysis'
  | 'adaptation'

/**
 * Agents whose stored confidence is not shown at all. Calendar Optimization's
 * was 0.75 for everyone, a constant that measured nothing about the schedule;
 * new schedules store null, and older paths still hold 0.75, so it is hidden
 * here whatever is stored (docs/reports/calendar-optimization-2026-10-13.md).
 */
export const CONFIDENCE_HIDDEN: ReadonlySet<AgentKey> = new Set<AgentKey>(['calendar_optimization'])

export function insightMessage(agent: AgentKey, slice: any): string | null {
  if (!slice) return null
  if (typeof slice.explanation === 'string' && slice.explanation.trim()) return slice.explanation
  if (typeof slice.summary === 'string' && slice.summary.trim()) return slice.summary
  if (typeof slice.insight === 'string' && slice.insight.trim()) return slice.insight
  if (Array.isArray(slice.patterns) && slice.patterns.length) {
    const p = slice.patterns[0]
    return p?.insight || p?.description || `${slice.patterns.length} similar patterns found`
  }
  if (Array.isArray(slice.recommendations) && slice.recommendations.length) {
    return `${slice.recommendations.length} tools recommended for the norms you navigate.`
  }
  if (typeof slice.confidence === 'number' && !CONFIDENCE_HIDDEN.has(agent)) {
    return `Confidence: ${Math.round(slice.confidence * 100)}%`
  }
  return null
}
