import type { RecommendationBasis } from './types'

/**
 * When a score may be called a "% match". Shared by the card's badge
 * (components/agents/RecommendationResult.tsx) and the agent's explanations,
 * so the two never disagree. No server imports: the card is a client
 * component.
 *
 * A score is a match only when it rests on ratings from people with similar
 * norms, and only from MIN_MATCH_PERCENT up. Without such ratings (the cold
 * start), the score is a neutral 10 plus up to 30 for the community rating,
 * so an unrated place showed as a "10% match" and the best rated as "40%"
 * (Riipen Labs, Groups 22 and 24: "three matches at 40%", and "AI engine
 * suggests Autinerary to itself with a 10% match").
 */
export const MIN_MATCH_PERCENT = 50

export function showsMatchPercent(r: { basis?: RecommendationBasis; score?: number }): boolean {
  return r.basis === 'similar_people' && typeof r.score === 'number' && r.score >= MIN_MATCH_PERCENT
}
