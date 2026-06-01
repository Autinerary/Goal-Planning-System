import type { SpamCheckResult } from './types'

/**
 * Detect spam patterns in content
 * Agent autonomously identifies spam indicators
 */
export function detectSpam(content: string, allowURLs: boolean = false): SpamCheckResult {
  if (!content || typeof content !== 'string') {
    return {
      isSpam: false,
      spamScore: 0,
      indicators: [],
    }
  }

  const indicators: string[] = []
  let spamScore = 0

  // Check 1: Repeated characters (e.g., "GREAT!!!!!!")
  if (hasRepeatedCharacters(content)) {
    indicators.push('Repeated characters detected')
    spamScore += 20
  }

  // Check 2: Excessive capitalization
  if (hasExcessiveCapitalization(content)) {
    indicators.push('Excessive capitalization')
    spamScore += 15
  }

  // Check 3: URLs in content (if not allowed)
  if (!allowURLs && hasURLs(content)) {
    indicators.push('URLs detected in content')
    spamScore += 25
  }

  // Check 4: Suspicious keywords
  if (hasSuspiciousKeywords(content)) {
    indicators.push('Suspicious keywords detected')
    spamScore += 30
  }

  // Check 5: Too short or incoherent
  if (isTooShort(content)) {
    indicators.push('Content too short')
    spamScore += 10
  }

  // Check 6: Incoherent text (repeated words)
  if (hasIncoherentText(content)) {
    indicators.push('Incoherent or repetitive text')
    spamScore += 20
  }

  // Check 7: Excessive punctuation
  if (hasExcessivePunctuation(content)) {
    indicators.push('Excessive punctuation')
    spamScore += 15
  }

  // Check 8: Only numbers or symbols
  if (isOnlyNumbersOrSymbols(content)) {
    indicators.push('Content contains only numbers or symbols')
    spamScore += 25
  }

  return {
    isSpam: spamScore >= 50 || indicators.length >= 3,
    spamScore: Math.min(spamScore, 100),
    indicators,
  }
}

/**
 * Check for repeated characters (e.g., "GREAT!!!!!!")
 */
function hasRepeatedCharacters(content: string): boolean {
  // Check for 4+ consecutive identical characters
  return /(.)\1{3,}/.test(content)
}

/**
 * Check for excessive capitalization (more than 50% uppercase)
 */
function hasExcessiveCapitalization(content: string): boolean {
  const letters = content.replace(/[^a-zA-Z]/g, '')
  if (letters.length < 5) return false

  const uppercaseCount = letters.replace(/[a-z]/g, '').length
  const uppercaseRatio = uppercaseCount / letters.length

  return uppercaseRatio > 0.5 && uppercaseCount > 5
}

/**
 * Check for URLs in content
 */
function hasURLs(content: string): boolean {
  // Common URL patterns
  const urlPatterns = [
    /https?:\/\/[^\s]+/gi,
    /www\.[^\s]+/gi,
    /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/gi,
  ]

  return urlPatterns.some((pattern) => pattern.test(content))
}

/**
 * Check for suspicious keywords (common spam terms)
 */
function hasSuspiciousKeywords(content: string): boolean {
  const lowerContent = content.toLowerCase()

  // Common spam keywords
  const spamKeywords = [
    'click here',
    'buy now',
    'limited time',
    'act now',
    'free money',
    'make money fast',
    'guaranteed',
    'no credit check',
    '100% free',
    'work from home',
    'get rich quick',
    'miracle cure',
    'lose weight fast',
    'viagra',
    'casino',
    'lottery winner',
  ]

  return spamKeywords.some((keyword) => lowerContent.includes(keyword))
}

/**
 * Check if content is too short
 */
function isTooShort(content: string): boolean {
  // Minimum meaningful length (excluding whitespace)
  const trimmed = content.trim()
  return trimmed.length < 5
}

/**
 * Check for incoherent or repetitive text
 */
function hasIncoherentText(content: string): boolean {
  const words = content.toLowerCase().split(/\s+/).filter((w) => w.length > 2)

  if (words.length < 5) return false

  // Check for excessive word repetition (same word appears 3+ times in short text)
  const wordCounts = new Map<string, number>()
  words.forEach((word) => {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
  })

  const maxRepeat = Math.max(...Array.from(wordCounts.values()))
  return maxRepeat >= 4 && words.length < 20
}

/**
 * Check for excessive punctuation
 */
function hasExcessivePunctuation(content: string): boolean {
  // More than 30% punctuation
  const punctuationCount = (content.match(/[!?.,;:]/g) || []).length
  const totalChars = content.length
  return totalChars > 0 && punctuationCount / totalChars > 0.3
}

/**
 * Check if content is only numbers or symbols
 */
function isOnlyNumbersOrSymbols(content: string): boolean {
  // Remove whitespace and check if only numbers/symbols
  const cleaned = content.replace(/\s/g, '')
  return cleaned.length > 0 && /^[^a-zA-Z]+$/.test(cleaned)
}

/**
 * Check for profanity (basic pattern matching)
 * In production, use a library like 'bad-words-next'
 */
export function containsProfanity(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false
  }

  const lowerContent = content.toLowerCase()

  // Basic profanity patterns (expand with library in production)
  const profanityPatterns = [
    /\b(fuck|shit|damn|ass|bitch|bastard|piss|crap|hell)\b/gi,
    // Add more patterns as needed
  ]

  return profanityPatterns.some((pattern) => pattern.test(lowerContent))
}