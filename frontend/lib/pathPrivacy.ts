/**
 * Strip other people's details from a plan before a route returns it.
 *
 * A stored plan (user_paths.payload) keeps the Pattern Recognition result it
 * was built with: `similar_users` (each matched person's account id,
 * conditions, a goals summary, success rate and match score) and
 * `retrieved_user_ids`. On 8 Oct 2026, 81 of 95 stored plans held 487 such
 * entries, and they reached the owner's browser, connected friends and data
 * exports. This returns a copy without them, keeping the number of matches
 * (`similar_users_count`). The stored plan is not changed.
 *
 * Same rule as backend/core/path_privacy.py; both are tested against
 * backend/tests/fixtures/plan_with_other_people.json
 * (node --experimental-strip-types lib/pathPrivacy.test.mjs, from frontend/).
 */

const OTHER_PEOPLE_KEYS = ['similar_users', 'retrieved_user_ids'] as const

type PatternResponse = { agentId: string; result: Record<string, unknown> }

function holdsOtherPeople(response: unknown): response is PatternResponse {
  if (!response || typeof response !== 'object') return false
  const r = response as { agentId?: unknown; result?: unknown }
  return (
    r.agentId === 'pattern_recognition' &&
    !!r.result &&
    typeof r.result === 'object' &&
    OTHER_PEOPLE_KEYS.some((key) => key in (r.result as Record<string, unknown>))
  )
}

export function withoutOtherPeople<T>(payload: T): T {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  const responses = (payload as { agentResponses?: unknown }).agentResponses
  if (!Array.isArray(responses) || !responses.some(holdsOtherPeople)) return payload
  const clean = structuredClone(payload) as unknown as { agentResponses: unknown[] }
  for (const response of clean.agentResponses) {
    if (!holdsOtherPeople(response)) continue
    const matches = response.result.similar_users
    if (Array.isArray(matches)) response.result.similar_users_count = matches.length
    for (const key of OTHER_PEOPLE_KEYS) delete response.result[key]
  }
  return clean as T
}
