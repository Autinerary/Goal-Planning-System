import { rankResults } from './ranker'
import { generateExplanation, generateResultExplanation, generateAgentContributions } from './explainer'
import {
  buildSynthesisKey,
  getAgentScores,
  recordAgentDecisions,
  type AgentDecisionInput,
} from '@/lib/agents/shared/servicehub-learning'
import { PatternRecognitionAgent } from '@/lib/agents/pattern-agent'
import type {
  SynthesisInput,
  SynthesisOutput,
  AgentContribution,
  RankedResult,
} from './types'
import type { RecommendationAgentOutput } from '@/lib/agents/recommendation-agent/types'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'
import type { ValidationAgentOutput } from '@/lib/agents/validation-agent/types'

// How many top results to credit when reward eventually lands. Cap so a
// large batch doesn't dominate the bandit aggregate.
const TRACE_TOP_K = 20

/**
 * Synthesis Engine: Combines agent outputs into final response
 * MVP: Rule-based synthesis (will upgrade to LLM-powered explanations post-funding)
 * Job: Weigh agent inputs and resolve conflicts
 *
 * Architecture: Central synthesis layer for all agent outputs
 * - Current: Rule-based ranking and explanation generation
 * - Future: LLM-powered natural language explanations and advanced conflict resolution
 *
 * Migration Path: Replace rule-based explanation generation with LLM calls while keeping same interface
 */
export class SynthesisEngine {
  /**
   * Main synthesis function
   * Combines outputs from all agents into coherent final response
   */
  async synthesize(input: SynthesisInput): Promise<SynthesisOutput> {
    try {
      // Extract outputs from each agent
      const recommendations = input.agentOutputs.RecommendationAgent
      const patterns = input.agentOutputs.PatternAgent
      const validations = input.agentOutputs.ValidationAgent

      // Step 1: Combine and rank results
      const { rankedResults, rankingFactors } = rankResults(
        recommendations,
        patterns as DiscoveredPattern[],
        validations as any
      )

      // Step 2: Filter based on validation (remove rejected items)
      const validatedResults = this.applyValidation(rankedResults, validations)

      // Step 3: Generate human-readable explanations
      const explanation = await generateExplanation(
        validatedResults,
        input.agentOutputs,
        input.userContext
      )

      // Generate explanations for each result
      validatedResults.forEach((result) => {
        result.explanation = generateResultExplanation(
          result,
          input.agentOutputs,
          input.userContext
        )
      })

      // Step 4: Calculate overall confidence
      const confidence = this.calculateOverallConfidence(input.agentOutputs)

      // Step 5: Document agent contributions
      const agentContributions = this.documentContributions(input.agentOutputs)

      // Step 6: Pick the synthesis strategy slug. Bandit-aware — when
      // learned reward says one slug clearly beats the others for this
      // request type, prefer it. Falls back to the deterministic default
      // when there's no history yet.
      const strategySlug = await this.pickStrategySlug(input.requestType)

      // Step 7: Fire-and-forget bandit trace writes. Each top-K result we
      // surface gets a synthesis decision row (so when the user later
      // rates one of these resources, the strategy_slug gets credited)
      // and pattern decision rows for each pattern that applied to it
      // (closes the pattern-agent loop too).
      this.traceDecisions(input, validatedResults, strategySlug)

      return {
        finalResults: validatedResults.map((r) => r.resource),
        explanation,
        agentContributions,
        confidence,
        metadata: {
          rankingFactors,
          filteredCount: rankedResults.length - validatedResults.length,
          synthesisStrategy: this.getSynthesisStrategy(input.requestType),
        },
      }
    } catch (error) {
      console.error('[Synthesis Engine] Error synthesizing results:', error)
      // Return fallback result
      return {
        finalResults: [],
        explanation: 'Unable to synthesize results',
        agentContributions: [],
        confidence: 0,
      }
    }
  }

  /**
   * Apply validation filtering to results
   * Removes items that were rejected by validation agent
   */
  private applyValidation(
    rankedResults: RankedResult[],
    validations: ValidationAgentOutput | undefined
  ): RankedResult[] {
    if (!validations || validations.decision !== 'reject') {
      // No validation rejections, return all results
      return rankedResults
    }

    // Filter out rejected items
    // In practice, validations would be an array of validation results per resource
    // For now, we'll just return all results if validation didn't explicitly reject
    return rankedResults
  }

  /**
   * Synthesis Engine calculates overall confidence
   * Weighted average of agent confidences
   */
  private calculateOverallConfidence(agentOutputs: any): number {
    const weights: { [key: string]: number } = {
      RecommendationAgent: 0.4,
      PatternAgent: 0.3,
      ValidationAgent: 0.3,
      SearchService: 0.2,
    }

    let totalConfidence = 0
    let totalWeight = 0

    Object.entries(agentOutputs).forEach(([agentName, output]) => {
      if (!output) return

      const weight = weights[agentName] || 0.2
      let confidence = 0

      // Extract confidence from different output formats
      if (typeof output === 'object' && output !== null) {
        if ('confidence' in output && typeof (output as any).confidence === 'number') {
          confidence = (output as any).confidence
        } else if (Array.isArray(output) && output.length > 0) {
          // For pattern arrays, average confidence
          const confidences = output
            .map((p: any) => p.confidence || 0)
            .filter((c: number) => c > 0)
          confidence =
            confidences.length > 0
              ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
              : 50
        } else {
          confidence = 50 // Default confidence if not specified
        }
      }

      totalConfidence += confidence * weight
      totalWeight += weight
    })

    return totalWeight > 0 ? Math.round(totalConfidence / totalWeight) : 0
  }

  /**
   * Document which agents contributed what
   */
  private documentContributions(agentOutputs: any): AgentContribution[] {
    const contributions = generateAgentContributions(agentOutputs)

    // Add metadata for each contribution
    return contributions.map((contrib) => ({
      agentName: contrib.agentName,
      contribution: contrib.contribution,
      confidence: contrib.confidence,
      outputCount: contrib.outputCount,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    }))
  }

  /**
   * Get synthesis strategy based on request type
   */
  private getSynthesisStrategy(requestType: string): string {
    switch (requestType) {
      case 'recommendations':
        return 'Weighted combination of recommendation scores, pattern insights, and community ratings'
      case 'search':
        return 'Semantic search with pattern-based re-ranking'
      case 'validate_submission':
        return 'Validation-first approach with quality checks'
      default:
        return 'Standard synthesis strategy'
    }
  }

  /**
   * Resolve conflicts between agents
   * Example: Recommendation Agent suggests X, but Validation Agent flags it
   */
  resolveConflicts(agentOutputs: any): any[] {
    const conflicts: any[] = []

    const recommendations = agentOutputs.RecommendationAgent
    const validation = agentOutputs.ValidationAgent

    if (!recommendations || !validation) {
      return conflicts
    }

    // Check if recommended resources conflict with validation
    if (recommendations.resources && validation.decision === 'reject') {
      // This is a conflict - recommendation suggests but validation rejects
      conflicts.push({
        type: 'recommendation_vs_validation',
        description: `Recommendation Agent suggests resource but Validation Agent flags it`,
        resolution: 'Trust Validation Agent for quality, filter out rejected items',
      })
    }

    return conflicts
  }

  // -------------------------------------------------------------------------
  // Bandit hooks. Read-side picks the strategy_slug; write-side records the
  // decisions that the ratings flow will later attribute reward to.
  // -------------------------------------------------------------------------

  /**
   * Pick the synthesis-strategy slug for this request. When learned reward
   * shows one slug clearly outperforming the others for this request_type,
   * prefer it. Otherwise fall back to the deterministic default mapping.
   *
   * Slugs are short stable strings (no spaces / human prose) so they can
   * serve as bandit keys without exploding the aggregate table.
   */
  private async pickStrategySlug(requestType: string): Promise<string> {
    const candidates = ['weighted_blend', 'pattern_heavy', 'community_heavy', 'recommendation_pure']
    const defaultSlug = this.defaultStrategySlug(requestType)

    try {
      const keys = candidates.map((s) => buildSynthesisKey(requestType, s))
      const scores = await getAgentScores('synthesis', keys, 5)
      if (scores.size === 0) return defaultSlug

      let best: { slug: string; avg: number } | null = null
      for (const slug of candidates) {
        const k = buildSynthesisKey(requestType, slug)
        const s = scores.get(k)
        if (!s) continue
        if (!best || s.rewardAvg > best.avg) {
          best = { slug, avg: s.rewardAvg }
        }
      }
      // Only override the default if learned signal is clearly positive.
      if (best && best.avg > 0.2) return best.slug
    } catch (err) {
      console.warn('[synthesis] strategy slug pick skipped:', err)
    }
    return defaultSlug
  }

  private defaultStrategySlug(requestType: string): string {
    switch (requestType) {
      case 'recommendations':
        return 'weighted_blend'
      case 'search':
        return 'pattern_heavy'
      case 'validate_submission':
        return 'recommendation_pure'
      default:
        return 'weighted_blend'
    }
  }

  /**
   * Fire-and-forget. Builds the bandit trace rows for synthesis (one per
   * top-K result) and pattern (one per (top-result, applying-pattern) pair)
   * and ships them in a single batch insert. Never throws into the caller.
   */
  private async traceDecisions(
    input: SynthesisInput,
    results: RankedResult[],
    strategySlug: string
  ): Promise<void> {
    if (!input.userContext?.userId) return
    const userId = input.userContext.userId
    const topResults = results.slice(0, TRACE_TOP_K)
    if (!topResults.length) return

    const synthesisKey = buildSynthesisKey(input.requestType, strategySlug)
    const patternsArr = (input.agentOutputs.PatternAgent as DiscoveredPattern[]) || []

    const decisions: AgentDecisionInput[] = []

    for (const r of topResults) {
      const resourceId = r.resource?.id || null
      if (!resourceId) continue

      // Synthesis decision: credit the strategy when this resource gets rated.
      decisions.push({
        agent: 'synthesis',
        decisionKey: synthesisKey,
        userId,
        resourceId,
      })

      // Pattern decisions: credit each pattern that contributed to ranking
      // this resource. Only emit when the result actually got a pattern
      // boost — otherwise no pattern applied.
      if (r.patternBoost > 0 && patternsArr.length) {
        for (const p of patternsArr) {
          if (!this.patternApplies(p, r.resource)) continue
          decisions.push({
            agent: 'pattern',
            decisionKey: PatternRecognitionAgent.patternKey(p),
            userId,
            resourceId,
            confidence: p.confidence,
          })
        }
      }
    }

    if (!decisions.length) return
    try {
      await recordAgentDecisions(decisions)
    } catch (err) {
      console.warn('[synthesis] decision trace skipped:', err)
    }
  }

  /**
   * Heuristic match between a discovered pattern and a resource. Same
   * shape rule as ranker.calculatePatternBoost — pattern applies when its
   * resource_categories include the resource category, or when the
   * pattern is a barrier_combination / intersectionality pattern and the
   * resource has at least one matching category.
   */
  private patternApplies(p: DiscoveredPattern, resource: any): boolean {
    if (!p || !resource) return false
    const cats = p.pattern?.resource_categories || []
    const rcat = String(resource.category || '').toLowerCase()
    if (cats.length && cats.some((c) => String(c).toLowerCase() === rcat)) return true
    // Barrier-combination patterns apply to all resources in the batch
    // (they're a user-side signal, not a resource-side signal), so we let
    // them through. The bandit aggregate will smooth out false positives.
    if (p.type === 'barrier_combination') return true
    return false
  }
}

// Export singleton instance
export const synthesisEngine = new SynthesisEngine()