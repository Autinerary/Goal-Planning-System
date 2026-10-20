/**
 * What to avoid and what helps at each step (backend/core/milestone_guidance.py,
 * kept in the plan as payload.milestoneGuidance). The Race view's Avoidance
 * (red) and Suggestions (green) views and the Milestone view's "Top 5
 * mistakes made at this stage" all read the same entry, so they always
 * match (the team's notes, October 2026).
 */

export interface StepGuidance {
  name?: string
  avoid: string[]
  tips: string[]
  /** 'ai': written by AI for this step. 'general': general advice for this kind of step. */
  source: 'ai' | 'general'
}

const lines = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, n) : [])

/** A step's guidance, or null when there is none yet or the step was renamed since. */
export function guidanceFor(stored: unknown, id: string, name?: string): StepGuidance | null {
  const entry = stored && typeof stored === 'object' ? (stored as Record<string, any>)[id] : null
  if (!entry || typeof entry !== 'object') return null
  if (name && entry.name && entry.name !== name) return null
  const avoid = lines(entry.avoid, 5)
  if (!avoid.length) return null
  return { name: entry.name, avoid, tips: lines(entry.tips, 5), source: entry.source === 'ai' ? 'ai' : 'general' }
}

/** Whether every one of these steps has guidance already (nothing to ask for). */
export function guidanceComplete(stored: unknown, milestones: ReadonlyArray<{ id: string; name: string }>): boolean {
  return milestones.every((m) => guidanceFor(stored, m.id, m.name) !== null)
}

/** The line under a list, saying where it came from. */
export function guidanceSource(g: Pick<StepGuidance, 'source'>): string {
  return g.source === 'ai'
    ? 'Written by AI for this step of your plan. Not counted from people.'
    : 'General advice for this kind of step, and what you told us. Not counted from people.'
}
