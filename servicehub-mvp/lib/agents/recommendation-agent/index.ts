import { getUserBarriers, nearGroup, NEAR_KM } from '@/lib/supabase/queries'
import { isSelfListing } from '@/lib/resources/selfListing'
import { findSimilarUsersByBarriers } from './similarity'
import { getCandidateResources, getFallbackCandidateResources } from './matcher'
import { scoreResources } from './scorer'
import { showsMatchPercent } from './match'
import { completeJSON, isLLMEnabled, USER_TEXT_RULE, userList, userText } from '@/lib/llm'
import {
  loadUserMemory,
  recordRun,
  summarizeForPrompt,
  getToolOutcomeScores,
} from './memory'
import type {
  RecommendationAgentInput,
  RecommendationAgentOutput,
  ScoredResource,
  Barrier,
  Location,
} from './types'

function isUsefulExplanation(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length < 12 || text.length > 300) return false
  const lowered = text.toLowerCase()
  return ![
    'as an ai',
    'i cannot',
    "i can't",
    'lorem ipsum',
    'placeholder',
    'undefined',
  ].some((phrase) => lowered.includes(phrase))
}

const priceOf = (r: ScoredResource): number =>
  typeof r.price === 'number' && Number.isFinite(r.price) && r.price >= 0 ? r.price : Infinity

/**
 * Near first, then by score. With coordinates, places fall into distance
 * bands: within 10 km, within 50 km, then places with no map point that serve
 * the person's province or all of Canada (as search orders them,
 * compareNearFirst in lib/supabase/queries.ts), then farther places, then
 * other provinces' organisations. Within a band the higher score comes first;
 * a lower price only breaks a tie, then the nearer place.
 *
 * The list used to be sorted by price first and score second. That threw
 * away the matcher's nearest-first order, so the top cards could be anywhere
 * in Canada (Riipen Labs, Groups 22 and 24: "three matches at 40%, in the
 * wrong cities"). Free and cheaper places are still preferred, as Chi asked,
 * but no longer over distance or fit.
 */
function orderRecommendations(resources: ScoredResource[], location?: Location): ScoredResource[] {
  const hasCoords = Boolean(location?.lat && location?.lng)
  const band = (r: ScoredResource): number => {
    if (!hasCoords) return 0
    if (typeof r.distance === 'number') return r.distance <= 10 ? 0 : r.distance <= NEAR_KM ? 1 : 3
    return nearGroup(r, NEAR_KM, location?.province) === 1 ? 2 : 4
  }
  return [...resources].sort((a, b) => {
    if (band(a) !== band(b)) return band(a) - band(b)
    if (a.score !== b.score) return b.score - a.score
    if (priceOf(a) !== priceOf(b)) return priceOf(a) - priceOf(b)
    if (typeof a.distance === 'number' && typeof b.distance === 'number') return a.distance - b.distance
    return 0
  })
}

/**
 * Agent 1: Recommendation Agent
 * MVP: Rule-based matching (will upgrade to LLM-powered agent post-funding)
 * Job: Match people with resources based on their barriers
 *
 * Architecture: Modular design allows easy upgrade to true AI agent
 * - Current: Rule-based algorithms using vector similarity
 * - Future: LLM-powered decision-making with same interface
 *
 * Migration Path: Replace scoring functions with Claude API calls while keeping same interface
 */
export class RecommendationAgent {
  /**
   * Main agent decision-making function
   * Generates personalized resource recommendations
   */
  async generateRecommendations(
    input: RecommendationAgentInput
  ): Promise<RecommendationAgentOutput> {
    try {
      // Step 0: Load this user's cross-session memory so the agent can build
      // on past recommendations instead of starting fresh.
      const memory = await loadUserMemory(input.userId)

      // Step 0b: Pull cross-product learned tool reward scores in parallel
      // with the rest of step 1. Same `tool_outcomes` table the goal-planning
      // tool agent writes to, so a positive reflection over there boosts a
      // resource over here.
      const barrierTypes = (input.barriers || []).map((b) => b.type)
      const learnedScoresPromise = getToolOutcomeScores(barrierTypes)

      // Step 1: Find similar users (collaborative filtering)
      const similarUsers = await this.findSimilarUsers(input.userId, input.barriers)

      // Step 2: Get resources rated highly by similar users
      const candidateResources = await this.getCandidateResources(
        similarUsers,
        input.location
      )

      // Step 2b: Cold-start fallback. New users, niche barrier profiles, or
      // cases where vector similarity finds no neighbours produce zero
      // collaborative candidates — which used to surface as "No results
      // found". Fall back to ranking approved resources directly so the user
      // always gets recommendations.
      const effectiveCandidates =
        candidateResources.length > 0
          ? candidateResources
          : await getFallbackCandidateResources(input.location)

      // Wait on the learned scores before scoring.
      const learnedScores = await learnedScoresPromise

      // Step 3: Score each resource (agent's decision-making)
      const scored = await this.scoreResources(
        effectiveCandidates,
        input.barriers,
        input.context,
        learnedScores
      )

      // Step 3b: Order near first (orderRecommendations). Autinerary's own
      // listing never reaches the list (lib/resources/selfListing.ts): the
      // matcher leaves it out of both pools, and the final list is checked too.
      const scoredResources = orderRecommendations(
        scored.filter((r) => !isSelfListing(r)),
        input.location
      )

      // Step 4: Generate explanations (why agent chose these), memory-aware
      const explanations = await this.generateExplanations(
        scoredResources,
        input.barriers,
        input.context,
        summarizeForPrompt(memory)
      )

      // Step 5: Calculate confidence score
      const confidence = this.calculateConfidence(scoredResources, similarUsers.length)

      const output: RecommendationAgentOutput = {
        resources: scoredResources.slice(0, 20), // Top 20 recommendations
        // One pool per run, so one basis: the home page words the section by it.
        basis: scoredResources[0]?.basis,
        matchScores: scoredResources.map((r) => r.score),
        explanations,
        confidence,
        memory: {
          runCount: memory.runCount,
          // Earlier runs may have suggested Autinerary itself.
          lastTopResources: memory.lastTopResources.filter((name) => !isSelfListing({ name })),
        },
      }

      // Step 6: Append this run to the user's persistent agent memory
      await recordRun(input.userId, input, output)

      return output
    } catch (error) {
      console.error('Error generating recommendations:', error)
      // Return empty result on error
      return {
        resources: [],
        matchScores: [],
        explanations: [],
        confidence: 0,
      }
    }
  }

  /**
   * Helper function: Find similar users
   * Uses vector database for similarity matching
   */
  private async findSimilarUsers(userId: string, barriers: Barrier[]) {
    try {
      // Using vector database for similarity!
      const similarUsers = await findSimilarUsersByBarriers(userId, barriers, 50, 0.7)

      // Vector DB returns users with similar barrier embeddings
      // Much more accurate than manual comparison
      return similarUsers
    } catch (error) {
      console.error('Error finding similar users:', error)
      return []
    }
  }

  /**
   * Helper function: Get candidate resources
   * Filters resources rated highly by similar users
   */
  private async getCandidateResources(similarUsers: any[], location?: any) {
    if (similarUsers.length === 0) {
      return []
    }

    return getCandidateResources(similarUsers, location, 100)
  }

  /**
   * Helper function: Score resources
   * Agent's scoring algorithm
   */
  private async scoreResources(
    candidateResources: any[],
    barriers: Barrier[],
    context?: string,
    learnedToolScores?: Map<string, number>
  ) {
    return scoreResources(candidateResources, barriers, context, learnedToolScores)
  }

  /**
   * Generate explanations for recommendations
   * Agent explains its decisions (LLM-backed with rule-based fallback).
   */
  private async generateExplanations(
    resources: ScoredResource[],
    barriers: Barrier[],
    supportContext: string = '',
    memoryHint: string = ''
  ): Promise<string[]> {
    const ruleBased = (resource: ScoredResource): string => {
      const parts: string[] = []
      if (resource.similarUsersCount > 0) {
        const barrierTypes = barriers
          .slice(0, 2)
          .map((b) => b.type)
          .join(' + ')
        parts.push(
          `Based on those who matched your Diagnostics profile${barrierTypes ? ` (${barrierTypes})` : ''} — recommended by ${resource.similarUsersCount} similar ${resource.similarUsersCount === 1 ? 'person' : 'people'}`
        )
      }
      // A percentage only where the card shows one (match.ts).
      if (showsMatchPercent(resource)) {
        parts.push(
          resource.score >= 80 ? `${resource.score}% match for your profile` : `${resource.score}% match`
        )
      }
      if (resource.averageRatingFromSimilarUsers >= 4.5) parts.push('Highly rated (4.5+ stars)')
      return parts.length > 0 ? parts.join(' • ') : resource.matchReason
    }

    if (!isLLMEnabled() || resources.length === 0) {
      return resources.map(ruleBased)
    }

    const top = resources.slice(0, 10)
    const payload = top.map((r, i) => ({
      i,
      name: (r as any).name || (r as any).resource_name || `Resource ${i}`,
      // Only a real match has a percentage to give (match.ts); a score was
      // passed for every resource, so a cold-start "40%" could be called a
      // match in the explanation too.
      matchPercent: showsMatchPercent(r) ? r.score : undefined,
      similarUsers: r.similarUsersCount,
      avgRating: r.averageRatingFromSimilarUsers,
    }))

    const data = await completeJSON<{ explanations: string[] }>(
      'You explain why specific community resources fit a neurodivergent user. Be concise, warm, and specific. When a resource was rated by similar users, frame it as being "based on those who matched your Diagnostics profile". ' +
        USER_TEXT_RULE,
      `Barriers (the user's Diagnostics profile): ${userList(barriers.map((b) => b.type))}\n` +
        (supportContext ? `Functional support needs: ${userText(supportContext, 3000)}\n` : '') +
        (memoryHint ? `Prior history:\n${userText(memoryHint, 1500)}\n` : '') +
        `Resources (JSON): ${JSON.stringify(payload)}\n` +
        `Return JSON: {"explanations": ["sentence about resource 0", "sentence about resource 1", ...]}\n` +
        `One sentence (max 25 words) per resource, same order as input. For resources with similarUsers > 0, start with "Based on those who matched your Diagnostics profile". ` +
        `Give a match percentage only for resources that have matchPercent, and no other percentage.`,
      { temperature: 0.5, maxTokens: 600 }
    )

    if (data && Array.isArray(data.explanations) && data.explanations.length === top.length) {
      const llmExplanations = data.explanations.map((explanation, index) =>
        isUsefulExplanation(explanation)
          ? explanation.replace(/\s+/g, ' ').trim()
          : ruleBased(top[index])
      )
      // Append rule-based for any resources beyond the top batch
      return [...llmExplanations, ...resources.slice(10).map(ruleBased)]
    }
    return resources.map(ruleBased)
  }

  /**
   * Calculate agent's confidence in recommendations
   * Based on number of similar users and recommendation quality
   */
  private calculateConfidence(
    resources: ScoredResource[],
    similarUsersCount: number
  ): number {
    if (resources.length === 0) {
      return 0
    }

    // Base confidence from similar users count (0-50%)
    const userConfidence = Math.min((similarUsersCount / 50) * 50, 50)

    // Confidence from recommendation quality (0-50%)
    const avgScore = resources.reduce((sum, r) => sum + r.score, 0) / resources.length
    const qualityConfidence = (avgScore / 100) * 50

    // Total confidence (0-100%)
    const totalConfidence = userConfidence + qualityConfidence

    return Math.round(Math.min(totalConfidence, 100))
  }
}

// Export singleton instance
export const recommendationAgent = new RecommendationAgent()