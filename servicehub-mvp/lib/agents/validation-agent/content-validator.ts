import { createClient } from '@/lib/supabase/server'
import { detectSpam, containsProfanity } from './spam-detector'
import { completeJSON, isLLMEnabled } from '@/lib/llm'
import type { ContentCheckResult } from './types'

/**
 * Validate content quality
 * Agent checks for various content issues
 */
export async function validateContent(
  item: any,
  itemType: 'rating' | 'resource' | 'user'
): Promise<ContentCheckResult> {
  const issues: string[] = []
  let contentText = ''

  // Extract content text based on item type
  if (itemType === 'rating') {
    contentText = item.comment || item.text || ''
  } else if (itemType === 'resource') {
    contentText = `${item.name || ''} ${item.description || ''}`.trim()
  } else if (itemType === 'user') {
    contentText = item.bio || item.description || ''
  }

  // Check 1: Profanity
  if (contentText && containsProfanity(contentText)) {
    issues.push('Contains inappropriate language')
  }

  // Check 2: Spam patterns
  const spamCheck = detectSpam(contentText, itemType === 'resource') // Allow URLs in resources
  if (spamCheck.isSpam) {
    issues.push(`Spam indicators detected: ${spamCheck.indicators.join(', ')}`)
  }

  // Check 3: Completeness
  if (!isComplete(item, itemType)) {
    issues.push('Missing required information')
  }

  // Check 4: Duplicates
  if (await isDuplicate(item, itemType)) {
    issues.push('Duplicate submission detected')
  }

  // Check 5: Length validation
  if (itemType === 'rating' && contentText && contentText.length > 500) {
    issues.push('Comment exceeds maximum length (500 characters)')
  }

  if (itemType === 'resource' && contentText && contentText.length < 10) {
    issues.push('Description too short (minimum 10 characters)')
  }

  // Check 6: LLM-powered safety moderation (graceful no-op if disabled)
  if (isLLMEnabled() && contentText && contentText.length >= 20) {
    const moderation = await completeJSON<{
      safe: boolean
      issues: string[]
    }>(
      'You are a content safety reviewer for a neurodivergent community resource platform. Flag content only for: harassment, hate speech, scams, dangerous medical claims, doxxing, or explicit sexual content. Be permissive of frank personal stories.',
      `Item type: ${itemType}\nContent: """${contentText.slice(0, 1500)}"""\n` +
        `Return JSON: {"safe": boolean, "issues": ["short reason", ...]}`,
      { temperature: 0.1, maxTokens: 200 }
    )
    if (moderation && moderation.safe === false && Array.isArray(moderation.issues)) {
      for (const i of moderation.issues.slice(0, 3)) {
        if (i && typeof i === 'string') issues.push(`AI safety: ${i}`)
      }
    }
  }

  const score = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 25)

  return {
    passed: issues.length === 0 && spamCheck.spamScore < 50,
    score,
    issues,
  }
}

/**
 * Check if item is complete (has required fields)
 */
function isComplete(item: any, itemType: 'rating' | 'resource' | 'user'): boolean {
  if (itemType === 'rating') {
    // Rating must have overall_score
    return item.overall_score !== undefined && item.overall_score !== null
  } else if (itemType === 'resource') {
    // Resource must have name, category, and description
    return !!(item.name && item.category && item.description)
  } else if (itemType === 'user') {
    // User profile must have basic info
    return !!(item.email || item.id)
  }

  return false
}

/**
 * Check if item is a duplicate
 */
async function isDuplicate(item: any, itemType: 'rating' | 'resource' | 'user'): Promise<boolean> {
  const supabase = createClient()

  try {
    if (itemType === 'rating') {
      // Check if user already rated this resource
      if (!item.user_id || !item.resource_id) {
        return false
      }

      const { data: existing } = await supabase
        .from('ratings')
        .select('id')
        .eq('user_id', item.user_id)
        .eq('resource_id', item.resource_id)
        .limit(1)

      return (existing?.length || 0) > 0
    } else if (itemType === 'resource') {
      // Check for duplicate resources (same name + location)
      if (!item.name || !item.location) {
        return false
      }

      const location = typeof item.location === 'string' ? JSON.parse(item.location) : item.location

      if (!location.city) {
        return false
      }

      const { data: existing } = await supabase
        .from('resources')
        .select('id')
        .eq('name', item.name)
        .limit(10) // Get potential matches

      if (!existing || existing.length === 0) {
        return false
      }

      // Check location similarity for potential matches
      for (const existingResource of existing) {
        // In production, you'd check location more precisely
        // For now, just check name + city match
        const existingLocation =
          typeof existingResource.location === 'string'
            ? JSON.parse(existingResource.location)
            : existingResource.location

        if (existingLocation?.city === location.city) {
          return true
        }
      }

      return false
    } else if (itemType === 'user') {
      // Check for duplicate email
      if (!item.email) {
        return false
      }

      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', item.email)
        .limit(1)

      return (existing?.length || 0) > 0
    }

    return false
  } catch (error) {
    console.error('Error checking duplicates:', error)
    return false // Don't block on error
  }
}