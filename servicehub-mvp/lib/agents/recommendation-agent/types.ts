import type { UserBarrier, Resource, Location } from '@/types/database'

// Re-export for use in other recommendation-agent modules
export type { Resource, Location }

export interface Barrier {
  category: string
  type: string
  severity?: number
  notes?: string
}

export interface RecommendationAgentInput {
  userId: string
  barriers: Barrier[]
  location?: Location
  context?: string // "new to autism", "looking for therapist", etc.
}

/**
 * What a score rests on. 'similar_people': ratings from people whose norms
 * are like this person's, so the score is a match. 'ratings': no such ratings
 * yet (the cold-start fallback), so the score is only the community rating
 * and is not a match (match.ts).
 */
export type RecommendationBasis = 'similar_people' | 'ratings'

export interface RecommendationAgentOutput {
  resources: ScoredResource[]
  /** The same for every resource in one run. Absent when nothing was found. */
  basis?: RecommendationBasis
  matchScores: number[]
  explanations: string[]
  confidence: number // Agent's confidence in recommendations (0-100)
  /**
   * Cross-session memory summary for the requesting user. Present when the
   * agent has seen this user before so the UI can show a "building on your past
   * recommendations" note. Undefined / runCount 0 means a fresh user.
   */
  memory?: {
    runCount: number
    lastTopResources: string[]
  }
}

export interface ScoredResource extends Resource {
  score: number
  matchReason: string
  similarUsersCount: number
  /** With basis 'ratings', this is the community's average instead. */
  averageRatingFromSimilarUsers: number
  basis: RecommendationBasis
  /** How many ratings averageRatingFromSimilarUsers comes from. */
  ratingCount: number
  /** km from the person, when both have a map point. */
  distance?: number
}

export interface SimilarUser {
  user_id: string
  similarity: number
  barriers?: UserBarrier[]
}

export interface CandidateResource {
  resource: Resource
  ratingsFromSimilarUsers: Array<{
    user_id: string
    overall_score: number
    barrier_scores?: any
  }>
  similarUsersCount: number
  averageRating: number
  basis: RecommendationBasis
  /** How many ratings averageRating comes from. */
  ratingCount: number
  /** km from the person, when both have a map point. */
  distance?: number
}