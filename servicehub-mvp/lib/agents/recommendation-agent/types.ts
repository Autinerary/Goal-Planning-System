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

export interface RecommendationAgentOutput {
  resources: ScoredResource[]
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
  averageRatingFromSimilarUsers: number
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
}