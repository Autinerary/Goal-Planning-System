/**
 * "What motivates you?" and "What life stage are you in?": asked in setup
 * until Riipen Labs' Groups 25 to 30 (September 2026) asked for the optional
 * questions to move into the app, so people reach their plan sooner. They are
 * now on the "Complete your profile" card (components/ProfileCompletion.tsx),
 * kept in profiles.preferences.motivation. The backend reads the first
 * motivation when it matches people motivated in similar ways
 * (backend/core/pattern_reindex.py).
 *
 * The ids are the ones setup stored, so answers given in setup still match.
 */

export const MOTIVATION_OPTIONS = [
  { value: 'intrinsic', label: 'Intrinsic', description: 'Driven by personal satisfaction and internal goals' },
  { value: 'achievement', label: 'Achievement', description: 'Motivated by accomplishments and milestones' },
  { value: 'social', label: 'Social Connection', description: 'Energized by community and relationships' },
  { value: 'reward', label: 'Reward-Based', description: 'Responds well to incentives and treats' },
  { value: 'deadline', label: 'Deadline-Driven', description: 'Works best with time pressure' },
  { value: 'curiosity', label: 'Curiosity', description: 'Motivated by learning and discovery' },
] as const

// Autinerary is 18+ for now (Odosa), so the stages nobody over 18 can be in
// are gone. People are often in more than one at once, so it is a
// multi-select; "I'm not sure" is the absence of an answer and stands alone.
export const LIFE_STAGES = [
  { id: 'high_school', label: 'High School / Secondary' },
  { id: 'post_secondary', label: 'University / College / Trade School' },
  { id: 'post_graduate', label: 'Post-Graduate' },
  { id: 'employment', label: 'Employment / Career' },
  { id: 'retirement', label: 'Retirement' },
  { id: 'not_sure', label: "I'm Not Sure" },
] as const

export interface MotivationAnswer {
  types: string[]
  lifeStages: string[]
  updatedAt?: string
}

const MOTIVATION_IDS = new Set<string>(MOTIVATION_OPTIONS.map((o) => o.value))
const STAGE_IDS = new Set<string>(LIFE_STAGES.map((s) => s.id))

/** Only known ids, each once; "not sure" alone. */
export function cleanMotivation(value: unknown): MotivationAnswer {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const pick = (list: unknown, known: Set<string>) =>
    Array.from(new Set((Array.isArray(list) ? list : []).filter((x): x is string => typeof x === 'string' && known.has(x))))
  const stages = pick(v.lifeStages, STAGE_IDS)
  return {
    types: pick(v.types, MOTIVATION_IDS),
    lifeStages: stages.includes('not_sure') && stages.length > 1 ? stages.filter((s) => s !== 'not_sure') : stages,
    ...(typeof v.updatedAt === 'string' ? { updatedAt: v.updatedAt } : {}),
  }
}
