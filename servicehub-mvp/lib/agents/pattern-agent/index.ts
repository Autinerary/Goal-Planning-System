import { findBarrierCombinations, calculateCombinationConfidence } from './clustering'
import { findResourceAffinity } from './associations'
import { generateInsight, calculateNoveltyScore, calculateActionabilityScore } from './insights'
import { createClient } from '@/lib/supabase/server'
import { getResources } from '@/lib/supabase/queries'
import { getRatingsByResource } from '@/lib/supabase/queries'
import { getUserBarriers } from '@/lib/supabase/queries'
import { getProfile } from '@/lib/supabase/queries'
import {
  buildPatternKey,
  getAgentScores,
  type AgentScore,
} from '@/lib/agents/shared/servicehub-learning'
import type {
  PatternAgentInput,
  DiscoveredPattern,
  PatternScope,
  PatternType,
} from './types'
import type { Location } from '@/types/database'

/**
 * Agent 2: Pattern Recognition Agent
 * MVP: Statistical analysis (will upgrade to ML clustering post-funding)
 * Job: Find hidden connections and patterns autonomously
 *
 * Architecture: Modular design allows easy upgrade to ML/LLM-powered agent
 * - Current: Rule-based statistical analysis and SQL queries
 * - Future: ML clustering (k-means, DBSCAN) and LLM-powered insight generation
 *
 * Migration Path: Replace statistical analysis with ML algorithms and LLM calls
 */
export class PatternRecognitionAgent {
  /**
   * Main agent autonomous discovery function
   * Agent actively searches for patterns without being told what to find
   */
  async discoverPatterns(input: PatternAgentInput = {}): Promise<DiscoveredPattern[]> {
    try {
      const patterns: DiscoveredPattern[] = []
      const scope = input.scope || 'global'
      const minimumSupport = input.minimumSupport || 5

      // Discovery 1: Barrier combinations that frequently occur together
      const barrierPatterns = await this.findBarrierCombinations(
        scope,
        minimumSupport,
        input.category
      )
      patterns.push(...barrierPatterns)

      // Discovery 2: Resource affinity ("users who liked X also liked Y")
      const affinityPatterns = await this.findResourceAffinity(
        scope === 'category' ? 'category' : 'global',
        input.category,
        0.7
      )
      patterns.push(...affinityPatterns)

      // Discovery 3: Intersectionality patterns (multiple barriers + demographics)
      const intersectionalPatterns = await this.findIntersectionalityPatterns(scope, input.category)
      patterns.push(...intersectionalPatterns)

      // Discovery 4: Non-obvious discoveries (agent explores on its own)
      const surprisingPatterns = await this.exploreNonObviousConnections(scope, input.category)
      patterns.push(...surprisingPatterns)

      // Agent filters and ranks patterns by confidence and usefulness.
      // Learned bandit reward (from past patterns that led to high-rated
      // resources) is blended in by rankPatterns().
      return await this.rankPatterns(patterns)
    } catch (error) {
      console.error('Error discovering patterns:', error)
      return []
    }
  }

  /**
   * Agent discovers barrier combinations autonomously
   * Example discovery: "45% of users have autism + ADHD + sensory sensitivity"
   */
  private async findBarrierCombinations(
    scope: PatternScope,
    minimumSupport: number,
    category?: string
  ): Promise<DiscoveredPattern[]> {
    try {
      const combinations = await findBarrierCombinations(scope, minimumSupport, category)

      // Get total user count for confidence calculation
      const supabase = createClient()
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      const patterns: DiscoveredPattern[] = []

      for (const combination of combinations) {
        const confidence = calculateCombinationConfidence(
          combination.frequency,
          totalUsers || 1
        )

        // Generate insight
        const barrierNames = combination.combination.map((b) => {
          const parts = b.split(':')
          return parts.length > 1 ? parts[1] : b
        })

        const insight = `Discovered: ${combination.frequency} users have ${barrierNames.join(' + ')} together`

        patterns.push({
          type: 'barrier_combination',
          pattern: {
            barrier_combination: combination.combination,
            avg_severity: combination.avg_severity,
          },
          frequency: combination.frequency,
          confidence,
          insight,
          scope,
          category,
          metadata: {
            support_count: combination.frequency,
            novelty_score: calculateNoveltyScore({
              type: 'barrier_combination',
              pattern: { barrier_combination: combination.combination },
              frequency: combination.frequency,
              confidence,
              insight,
              scope,
            } as DiscoveredPattern),
            actionability_score: calculateActionabilityScore({
              type: 'barrier_combination',
              pattern: { barrier_combination: combination.combination },
              frequency: combination.frequency,
              confidence,
              insight,
              scope,
            } as DiscoveredPattern),
          },
        })
      }

      return patterns
    } catch (error) {
      console.error('Error finding barrier combinations:', error)
      return []
    }
  }

  /**
   * Agent discovers resource associations
   * Uses vector similarity to find related resources
   */
  private async findResourceAffinity(
    scope: PatternScope,
    category?: string,
    minimumStrength: number = 0.7
  ): Promise<DiscoveredPattern[]> {
    try {
      const affinities = await findResourceAffinity(
        scope === 'category' ? 'category' : 'global',
        category,
        minimumStrength
      )

      const patterns: DiscoveredPattern[] = []

      for (const affinity of affinities.slice(0, 20)) {
        // Get resource names for insight
        const source = await getResources({ limit: 1 })
        // In production, you'd fetch the actual resources here

        const confidence = Math.round(affinity.strength * 100)
        const insight = `Users who rated resource highly also rated related resource highly (${affinity.user_count} users, ${affinity.strength.toFixed(2)} correlation)`

        patterns.push({
          type: 'resource_affinity',
          pattern: {
            source_resource_id: affinity.source_resource_id,
            related_resource_ids: [affinity.related_resource_id],
            affinity_strength: affinity.strength,
          },
          frequency: affinity.user_count,
          confidence,
          insight,
          scope,
          category,
          metadata: {
            support_count: affinity.user_count,
            novelty_score: calculateNoveltyScore({
              type: 'resource_affinity',
              pattern: {},
              frequency: affinity.user_count,
              confidence,
              insight,
              scope,
            } as DiscoveredPattern),
            actionability_score: calculateActionabilityScore({
              type: 'resource_affinity',
              pattern: {},
              frequency: affinity.user_count,
              confidence,
              insight,
              scope,
            } as DiscoveredPattern),
          },
        })
      }

      return patterns
    } catch (error) {
      console.error('Error finding resource affinity:', error)
      return []
    }
  }

  /**
   * Agent discovers intersectionality patterns
   * Looks for patterns across multiple dimensions
   */
  private async findIntersectionalityPatterns(
    scope: PatternScope,
    category?: string
  ): Promise<DiscoveredPattern[]> {
    const supabase = createClient()
    const patterns: DiscoveredPattern[] = []

    try {
      // Get all users with their barriers and profiles
      const { data: profiles } = await supabase.from('profiles').select('id, location, role')

      if (!profiles || profiles.length === 0) {
        return []
      }

      // Sample users for analysis (to avoid performance issues)
      const sampleUsers = profiles.slice(0, 100)

      for (const profile of sampleUsers) {
        const barriers = await getUserBarriers(profile.id)

        if (barriers.length < 2) {
          continue
        }

        const location = profile.location as Location | null
        const barrierTypes = barriers.map((b) => `${b.barrier_category}:${b.barrier_type}`)

        // Get resources this user rated highly
        const { data: ratings } = await supabase
          .from('ratings')
          .select('resource_id')
          .eq('user_id', profile.id)
          .gte('overall_score', 4)
          .limit(10)

        if (!ratings || ratings.length === 0) {
          continue
        }

        // Get categories of resources rated highly
        const resourceIds = ratings.map((r) => r.resource_id)
        const { data: resources } = await supabase
          .from('resources')
          .select('category')
          .in('id', resourceIds)
          .eq('status', 'approved')

        if (!resources || resources.length === 0) {
          continue
        }

        const categories = [...new Set(resources.map((r) => r.category))]

        // Create intersectionality pattern
        if (categories.length > 0 && barrierTypes.length >= 2) {
          const frequency = 1 // Single user data point
          const insight = `User with ${barrierTypes.slice(0, 2).join(' + ')} ${
            location?.city ? `in ${location.city}` : ''
          } prefers ${categories.join(', ')} resources`

          patterns.push({
            type: 'intersectionality',
            pattern: {
              barriers: barrierTypes,
              demographics: {
                role: profile.role,
              },
              resource_categories: categories,
              location: location?.city || undefined,
            },
            frequency,
            confidence: 50, // Lower confidence for single user patterns
            insight,
            scope,
            location: location?.city || undefined,
            metadata: {
              support_count: frequency,
              novelty_score: calculateNoveltyScore({
                type: 'intersectionality',
                pattern: {},
                frequency,
                confidence: 50,
                insight,
                scope,
              } as DiscoveredPattern),
              actionability_score: calculateActionabilityScore({
                type: 'intersectionality',
                pattern: {},
                frequency,
                confidence: 50,
                insight,
                scope,
              } as DiscoveredPattern),
            },
          })
        }
      }

      // Aggregate similar patterns
      return this.aggregateIntersectionalityPatterns(patterns)
    } catch (error) {
      console.error('Error finding intersectionality patterns:', error)
      return []
    }
  }

  /**
   * Aggregate similar intersectionality patterns
   */
  private aggregateIntersectionalityPatterns(
    patterns: DiscoveredPattern[]
  ): DiscoveredPattern[] {
    const aggregated = new Map<string, DiscoveredPattern>()

    patterns.forEach((pattern) => {
      const key = `${pattern.pattern.barriers?.join('|')}-${pattern.pattern.resource_categories?.join('|')}-${pattern.location}`

      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!
        existing.frequency++
        existing.confidence = Math.min(existing.confidence + 10, 100)

        // Update metadata
        if (existing.metadata) {
          existing.metadata.support_count = existing.frequency
        }
      } else {
        aggregated.set(key, { ...pattern })
      }
    })

    // Filter by minimum frequency and confidence
    return Array.from(aggregated.values()).filter((p) => p.frequency >= 3 && p.confidence >= 60)
  }

  /**
   * Agent explores without predefined targets
   * Looks for surprising connections
   */
  private async exploreNonObviousConnections(
    scope: PatternScope,
    category?: string
  ): Promise<DiscoveredPattern[]> {
    const supabase = createClient()
    const patterns: DiscoveredPattern[] = []

    try {
      // Look for unexpected resource category preferences
      // Example: Sensory-sensitive users rate grocery stores highly
      const { data: resources } = await supabase
        .from('resources')
        .select('id, category, name')
        .eq('status', 'approved')
        .limit(50)

      if (!resources || resources.length === 0) {
        return []
      }

      // For each resource, check if it's rated highly by users with specific barriers
      for (const resource of resources.slice(0, 20)) {
        const { data: ratings } = await supabase
          .from('ratings')
          .select('user_id, overall_score')
          .eq('resource_id', resource.id)
          .gte('overall_score', 4)
          .limit(20)

        if (!ratings || ratings.length < 5) {
          continue
        }

        // Get barriers of users who rated this resource highly
        const userIds = ratings.map((r) => r.user_id)
        const { data: barriers } = await supabase
          .from('user_barriers')
          .select('barrier_type, barrier_category')
          .in('user_id', userIds)

        if (!barriers || barriers.length === 0) {
          continue
        }

        // Find most common barriers
        const barrierCounts = new Map<string, number>()
        barriers.forEach((b) => {
          const key = `${b.barrier_category}:${b.barrier_type}`
          barrierCounts.set(key, (barrierCounts.get(key) || 0) + 1)
        })

        const sortedBarriers = Array.from(barrierCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)

        // If this resource category isn't obviously related to these barriers
        // but is rated highly, it's a non-obvious connection
        if (
          sortedBarriers.length >= 2 &&
          !this.isObviousConnection(resource.category, sortedBarriers.map((b) => b[0]))
        ) {
          const barrierTypes = sortedBarriers.map((b) => b[0].split(':')[1])
          const frequency = sortedBarriers[0][1]

          patterns.push({
            type: 'non_obvious',
            pattern: {
              connection_type: 'unexpected_category_preference',
              description: `${resource.name} (${resource.category}) is highly rated by users with ${barrierTypes.join(' + ')}`,
            },
            frequency,
            confidence: Math.min(frequency * 10, 85),
            insight: `Surprising discovery: Users with ${barrierTypes.join(' + ')} rate "${resource.name}" (${resource.category}) highly, even though it's not obviously related to their barriers.`,
            scope,
            category: resource.category,
            metadata: {
              support_count: frequency,
              novelty_score: 85,
              actionability_score: 50,
            },
          })
        }
      }

      return patterns.slice(0, 5) // Limit to top 5 surprising discoveries
    } catch (error) {
      console.error('Error exploring non-obvious connections:', error)
      return []
    }
  }

  /**
   * Check if connection is obviously expected
   */
  private isObviousConnection(category: string, barriers: string[]): boolean {
    // Define obvious connections
    const obvious: { [category: string]: string[] } = {
      therapist: ['autism', 'adhd', 'mental_health'],
      doctor: ['autism', 'adhd', 'health'],
      school: ['autism', 'adhd', 'education'],
    }

    const categoryLower = category.toLowerCase()
    const expectedBarriers = obvious[categoryLower] || []

    // Check if barriers match expected ones
    return barriers.some((b) =>
      expectedBarriers.some((expected) => b.toLowerCase().includes(expected))
    )
  }

  /**
   * Stable decision-key for a discovered pattern. Same shape is used by
   * synthesis-engine when it logs the pattern decision against a (user,
   * resource), so reads here line up with writes there.
   */
  static patternKey(p: DiscoveredPattern): string {
    let signature: string[] = []
    switch (p.type) {
      case 'barrier_combination':
        signature = p.pattern?.barrier_combination || []
        break
      case 'resource_affinity': {
        const src = p.pattern?.source_resource_id ? [p.pattern.source_resource_id] : []
        const rel = p.pattern?.related_resource_ids || []
        signature = [...src, ...rel]
        break
      }
      case 'intersectionality': {
        const b = p.pattern?.barriers || []
        const c = p.pattern?.resource_categories || []
        signature = [...b, ...c]
        break
      }
      case 'non_obvious': {
        const t = p.pattern?.connection_type ? [String(p.pattern.connection_type)] : []
        signature = t.length ? t : [String(p.pattern?.description || 'unknown').slice(0, 64)]
        break
      }
      default:
        signature = []
    }
    return buildPatternKey(p.type, signature)
  }

  /**
   * Agent prioritizes patterns by confidence, novelty, actionability, AND
   * learned reward from past patterns that produced high-rated resources.
   *
   * Learned reward is in [-1, +1]; we map it to a 0-20 point boost
   * (5% of the 100-point composite) so it tilts the order without
   * dominating cold-start patterns that have no reward history yet.
   */
  private async rankPatterns(patterns: DiscoveredPattern[]): Promise<DiscoveredPattern[]> {
    const eligible = patterns.filter((p) => p.confidence >= 50)
    if (!eligible.length) return []

    // Pull learned reward for every candidate pattern in one round-trip.
    const keys = eligible.map((p) => PatternRecognitionAgent.patternKey(p))
    let scores: Map<string, AgentScore> = new Map()
    try {
      scores = await getAgentScores('pattern', Array.from(new Set(keys)))
    } catch (err) {
      console.warn('[pattern-agent] learned-reward lookup skipped:', err)
    }

    return eligible
      .map((p) => {
        const key = PatternRecognitionAgent.patternKey(p)
        const learned = scores.get(key)
        // reward_avg in [-1, +1] → [0, 20] additive boost.
        const learnedBoost = learned ? (learned.rewardAvg + 1) * 10 : 0
        const composite =
          p.confidence * 0.5 +
          (p.metadata?.novelty_score || 0) * 0.2 +
          (p.metadata?.actionability_score || 0) * 0.3 +
          learnedBoost
        return { p, composite }
      })
      .sort((a, b) => b.composite - a.composite)
      .map((entry) => entry.p)
      .slice(0, 50) // Top 50 patterns
  }
}

// Export singleton instance
export const patternAgent = new PatternRecognitionAgent()