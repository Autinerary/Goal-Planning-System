/**
 * The names of the areas a service is rated on (the team's notes: "Change
 * rating names from ____-Support to ____-Friendliness"). One list for the
 * rating form, the Rating Breakdown and each review's scores, so a score is
 * called the same thing wherever it shows. Keys are as ratings store them
 * (ratings.barrier_scores).
 */
const NAMES: Record<string, string> = {
  autism: 'Autism-Friendliness',
  adhd: 'ADHD-Friendliness',
  sensory: 'Sensory-Friendliness',
  sensory_friendly: 'Sensory-Friendliness',
  mobility: 'Mobility-Friendliness',
  cognitive: 'Cognitive-Friendliness',
  social: 'Social-Friendliness',
  communication: 'Communication-Friendliness',
  accessibility: 'Accessibility',
  staff_knowledge: 'Staff Knowledge',
  wait_time: 'Wait Times',
  affordability: 'Affordability',
}

/** "sensory" → "Sensory-Friendliness"; anything else in sentence case. */
export function areaName(key: string): string {
  const k = String(key || '').toLowerCase()
  if (NAMES[k]) return NAMES[k]
  const words = k.replace(/_/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : words
}
