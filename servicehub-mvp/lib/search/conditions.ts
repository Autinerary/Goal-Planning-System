// ============================================================================
// Hierarchical "Conditions" filter for the resources Filter panel.
// This is intentionally a separate tree from the existing barriers data, so
// it does not depend on user_barriers being seeded — it's a static taxonomy
// the resource browser can filter against.
//
// Encoding scheme used on the wire:
//   "autism"              -> condition only
//   "autism:level_2"      -> condition + sub-option
//
// A user can select multiple conditions and (optionally) one sub-option per
// condition. Both forms are matched against resource tags / barrier_scores in
// the search API.
// ============================================================================

export interface ConditionSubOption {
  id: string
  label: string
}

export interface ConditionLeaf {
  id: string
  label: string
  // optional dropdown of sub-options (e.g. Autism -> Level 1 / 2 / 3)
  subOptions?: ConditionSubOption[]
}

export interface ConditionGroup {
  id: string
  label: string
  // either a flat list of leaves, or nested groups (used for personality clusters)
  conditions?: ConditionLeaf[]
  groups?: ConditionGroup[]
}

export const CONDITION_GROUPS: ConditionGroup[] = [
  {
    id: 'neurodevelopmental',
    label: 'Neurodevelopmental Conditions',
    conditions: [
      {
        id: 'autism',
        label: 'Autism',
        subOptions: [
          { id: 'level_1', label: 'Level 1' },
          { id: 'level_2', label: 'Level 2' },
          { id: 'level_3', label: 'Level 3' },
        ],
      },
      {
        id: 'adhd',
        label: 'ADHD',
        subOptions: [
          { id: 'inattentive', label: 'Inattentive' },
          { id: 'hyperactive', label: 'Hyperactive-Impulsive' },
          { id: 'combined', label: 'Combined' },
        ],
      },
      {
        id: 'specific_learning_disabilities',
        label: 'Specific Learning Disabilities',
      },
      { id: 'dyslexia', label: 'Dyslexia' },
      {
        id: 'motor_vocal_differences',
        label: 'Motor & Vocal Differences',
      },
      { id: 'tourette', label: 'Tourette' },
    ],
  },
  {
    id: 'mental_health',
    label: 'Mental Health Conditions',
    conditions: [
      { id: 'anxiety', label: 'Anxiety' },
      { id: 'ocd', label: 'OCD' },
    ],
  },
  {
    id: 'personality_disorders',
    label: 'Personality Disorders',
    groups: [
      {
        id: 'cluster_a',
        label: 'Cluster A',
        conditions: [
          { id: 'paranoid_pd', label: 'Paranoid' },
          { id: 'schizoid_pd', label: 'Schizoid' },
          { id: 'schizotypal_pd', label: 'Schizotypal' },
        ],
      },
      {
        id: 'cluster_b',
        label: 'Cluster B',
        conditions: [
          { id: 'antisocial_pd', label: 'Antisocial' },
          { id: 'borderline_pd', label: 'Borderline' },
          { id: 'histrionic_pd', label: 'Histrionic' },
          { id: 'narcissistic_pd', label: 'Narcissistic' },
        ],
      },
      {
        id: 'cluster_c',
        label: 'Cluster C',
        conditions: [
          { id: 'avoidant_pd', label: 'Avoidant' },
          { id: 'dependent_pd', label: 'Dependent' },
          { id: 'ocpd', label: 'OCPD' },
        ],
      },
    ],
  },
  {
    id: 'genetic_variations',
    label: 'Genetic Variations',
    conditions: [
      { id: 'down_syndrome', label: 'Down Syndrome' },
    ],
  },
]

/**
 * Encode a condition + optional sub-option into the URL/state form.
 * Examples: encode('autism') === 'autism'
 *           encode('autism', 'level_2') === 'autism:level_2'
 */
export function encodeCondition(conditionId: string, subOptionId?: string | null): string {
  return subOptionId ? `${conditionId}:${subOptionId}` : conditionId
}

export function decodeCondition(token: string): { id: string; sub?: string } {
  const idx = token.indexOf(':')
  if (idx === -1) return { id: token }
  return { id: token.slice(0, idx), sub: token.slice(idx + 1) }
}

/**
 * Find a condition leaf by id across the whole taxonomy (so we can look up
 * its label / sub-options from a token).
 */
export function findCondition(id: string): ConditionLeaf | undefined {
  for (const group of CONDITION_GROUPS) {
    if (group.conditions) {
      const found = group.conditions.find((c) => c.id === id)
      if (found) return found
    }
    if (group.groups) {
      for (const subGroup of group.groups) {
        if (subGroup.conditions) {
          const found = subGroup.conditions.find((c) => c.id === id)
          if (found) return found
        }
      }
    }
  }
  return undefined
}

/**
 * Convert a single condition token into a list of strings the search backend
 * can match against (resource tags, barrier_scores keys, etc.). Includes the
 * condition id, the sub-option id, and a combined id so the matcher has the
 * widest possible surface area.
 */
export function conditionTokenToMatchKeys(token: string): string[] {
  const { id, sub } = decodeCondition(token)
  const keys = [id]
  if (sub) {
    keys.push(sub)
    keys.push(`${id}_${sub}`)
  }
  return keys
}
