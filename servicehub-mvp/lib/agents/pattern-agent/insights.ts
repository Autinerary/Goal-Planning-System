import type { DiscoveredPattern, BarrierCombination, ResourceAffinity, IntersectionalityPattern } from './types'
import { getResourceById } from '@/lib/supabase/queries'
import { getResources } from '@/lib/supabase/queries'
import { completeText, isLLMEnabled } from '@/lib/llm'

/**
 * Generate human-readable insights from discovered patterns
 * Agent explains its discoveries in natural language.
 * Uses OpenAI when configured, falls back to rule-based phrasing.
 */
export async function generateInsight(pattern: DiscoveredPattern): Promise<string> {
  const ruleBased = await ruleBasedInsight(pattern)

  if (!isLLMEnabled()) return ruleBased

  const llm = await completeText(
    'You translate raw statistical patterns from a neurodiversity resource community into one concise, warm, plain-language insight (max 30 words).',
    `Pattern type: ${pattern.type}\n` +
      `Frequency: ${pattern.frequency}\n` +
      `Confidence: ${pattern.confidence}\n` +
      `Raw data: ${JSON.stringify(pattern.pattern).slice(0, 600)}\n` +
      `Fallback phrasing: ${ruleBased}\n` +
      `Return ONLY the sentence \u2014 no quotes, no preamble.`,
    { temperature: 0.5, maxTokens: 100 }
  )
  return llm || ruleBased
}

async function ruleBasedInsight(pattern: DiscoveredPattern): Promise<string> {
  switch (pattern.type) {
    case 'barrier_combination':
      return generateBarrierCombinationInsight(pattern)
    case 'resource_affinity':
      return generateResourceAffinityInsight(pattern)
    case 'intersectionality':
      return generateIntersectionalityInsight(pattern)
    case 'non_obvious':
      return generateNonObviousInsight(pattern)
    default:
      return pattern.insight || 'Pattern discovered'
  }
}

/**
 * Generate insight for barrier combination patterns
 */
async function generateBarrierCombinationInsight(pattern: DiscoveredPattern): Promise<string> {
  const data = pattern.pattern as any
  const combination = data.barrier_combination || []

  if (combination.length === 0) {
    return pattern.insight
  }

  // Format barrier names (remove category prefix if present)
  const barrierNames = combination.map((b: string) => {
    const parts = b.split(':')
    return parts.length > 1 ? parts[1] : b
  })

  const frequency = pattern.frequency
  const confidence = pattern.confidence

  // Generate different insights based on frequency and confidence
  if (frequency >= 20 && confidence >= 80) {
    return `Strong pattern: ${frequency} users have ${barrierNames.join(' + ')} together. This combination is more common than expected.`
  } else if (frequency >= 10) {
    return `Common pattern: ${frequency} users share the combination ${barrierNames.join(' + ')}. Resources addressing multiple barriers may be particularly helpful.`
  } else {
    return `Discovered: ${frequency} users have the barrier combination ${barrierNames.join(' + ')}. Consider resources that address these together.`
  }
}

/**
 * Generate insight for resource affinity patterns
 */
async function generateResourceAffinityInsight(pattern: DiscoveredPattern): Promise<string> {
  const data = pattern.pattern as any
  const sourceId = data.source_resource_id
  const relatedIds = data.related_resource_ids || []

  if (!sourceId || relatedIds.length === 0) {
    return pattern.insight
  }

  try {
    const source = await getResourceById(sourceId)
    if (!source) {
      return pattern.insight
    }

    // Get related resources
    const relatedResources = await Promise.all(
      relatedIds.slice(0, 3).map((id: string) => getResourceById(id))
    )
    const validRelated = relatedResources.filter((r) => r !== null)

    if (validRelated.length === 0) {
      return pattern.insight
    }

    const relatedNames = validRelated.map((r) => r!.name).join(', ')

    const userCount = pattern.frequency
    const strength = (pattern.pattern as any).affinity_strength || 0

    if (strength >= 0.8 && userCount >= 10) {
      return `Strong correlation: ${userCount} users who rated "${source.name}" highly also rated "${relatedNames}" highly. Consider recommending these together.`
    } else {
      return `Pattern: Users who like "${source.name}" also tend to rate "${relatedNames}" highly. These resources may serve similar needs.`
    }
  } catch (error) {
    console.error('Error generating resource affinity insight:', error)
    return pattern.insight
  }
}

/**
 * Generate insight for intersectionality patterns
 */
async function generateIntersectionalityInsight(pattern: DiscoveredPattern): Promise<string> {
  const data = pattern.pattern as any
  const barriers = data.barriers || []
  const demographics = data.demographics
  const categories = data.resource_categories || []
  const location = data.location

  const barrierNames = barriers.map((b: string) => {
    const parts = b.split(':')
    return parts.length > 1 ? parts[1] : b
  })

  const frequency = pattern.frequency

  let insight = `Intersectionality pattern: ${frequency} users with ${barrierNames.join(' + ')}`

  if (demographics) {
    if (demographics.ethnicity) {
      insight += ` who are ${demographics.ethnicity}`
    }
    if (demographics.language) {
      insight += ` and speak ${demographics.language}`
    }
  }

  if (categories.length > 0) {
    insight += ` prefer ${categories.join(', ')} resources`
  }

  if (location) {
    insight += ` in ${location}`
  }

  insight += ` at ${pattern.confidence}% higher rate than average.`

  return insight
}

/**
 * Generate insight for non-obvious connections
 */
async function generateNonObviousInsight(pattern: DiscoveredPattern): Promise<string> {
  const data = pattern.pattern as any
  const connectionType = data.connection_type
  const description = data.description

  if (description) {
    return `Unexpected discovery: ${description}`
  }

  if (connectionType) {
    return `Surprising pattern discovered: ${connectionType}. This connection wasn't immediately obvious but appears significant.`
  }

  return pattern.insight || 'Non-obvious pattern discovered'
}

/**
 * Calculate novelty score for a pattern
 * How surprising is this pattern compared to what we'd expect?
 */
export function calculateNoveltyScore(pattern: DiscoveredPattern): number {
  let novelty = 50 // Base novelty

  // Barrier combinations are more novel if they're unexpected
  if (pattern.type === 'barrier_combination') {
    const data = pattern.pattern as any
    const combination = data.barrier_combination || []
    // More barriers = more novel
    novelty += combination.length * 10
    // But cap at 90
    novelty = Math.min(novelty, 90)
  }

  // Non-obvious patterns are highly novel
  if (pattern.type === 'non_obvious') {
    novelty = 85
  }

  // Intersectionality patterns are moderately novel
  if (pattern.type === 'intersectionality') {
    novelty = 70
  }

  // Resource affinity is less novel (expected)
  if (pattern.type === 'resource_affinity') {
    novelty = 40
  }

  return Math.min(novelty, 100)
}

/**
 * Calculate actionability score
 * How useful is this pattern for recommendations?
 */
export function calculateActionabilityScore(pattern: DiscoveredPattern): number {
  let actionability = 50 // Base actionability

  // Resource affinity is highly actionable (direct recommendation)
  if (pattern.type === 'resource_affinity') {
    actionability = 90
  }

  // Barrier combinations are actionable (target resources for combinations)
  if (pattern.type === 'barrier_combination') {
    actionability = 75
  }

  // Intersectionality is moderately actionable
  if (pattern.type === 'intersectionality') {
    actionability = 70
  }

  // Non-obvious patterns may not be immediately actionable
  if (pattern.type === 'non_obvious') {
    actionability = 40
  }

  // Boost actionability with confidence
  if (pattern.confidence >= 80) {
    actionability += 10
  }

  return Math.min(actionability, 100)
}