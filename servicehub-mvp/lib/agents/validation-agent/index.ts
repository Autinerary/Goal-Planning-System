import { validateContent } from './content-validator'
import { detectSpam } from './spam-detector'
import { calculateUserTrust, getUserHistory } from './trust-scorer'
import { detectAbuse } from './abuse-detector'
import type {
  ValidationAgentInput,
  ValidationAgentOutput,
  ValidationCheck,
  UserHistory,
} from './types'

/**
 * Agent 3: Validation Agent
 * MVP: Rule-based validation (will upgrade to ML-based fraud detection post-funding)
 * Job: Independently decide what content is genuine vs. suspicious
 *
 * Architecture: Modular design allows easy upgrade to ML/LLM-powered validation
 * - Current: Rule-based checks and statistical analysis
 * - Future: ML-powered fraud detection, LLM content analysis, adaptive learning
 *
 * Migration Path: Replace rule-based checks with ML algorithms and LLM calls
 */
export class ValidationAgent {
  /**
   * Main agent decision-making function
   * Agent independently evaluates content quality
   */
  async validate(input: ValidationAgentInput): Promise<ValidationAgentOutput> {
    try {
      const checks: ValidationCheck[] = []

      // Get user history if not provided
      let userHistory: UserHistory | undefined = input.context.userHistory
      if (!userHistory) {
        userHistory = await getUserHistory(input.context.userId)
      }

      // Check 1: Content quality
      const contentCheck = await validateContent(input.item, input.itemType)
      checks.push({
        name: 'Content Quality',
        passed: contentCheck.passed,
        score: contentCheck.score,
        issues: contentCheck.issues,
      })

      // Check 2: Spam detection
      const contentText = this.extractContentText(input.item, input.itemType)
      const spamCheck = detectSpam(contentText, input.itemType === 'resource')
      checks.push({
        name: 'Spam Detection',
        passed: !spamCheck.isSpam,
        score: 100 - spamCheck.spamScore,
        issues: spamCheck.indicators,
      })

      // Check 3: User trust score
      const trustResult = await calculateUserTrust(input.context.userId)
      checks.push({
        name: 'User Trust',
        passed: trustResult.trustScore > 50,
        score: trustResult.trustScore,
        issues: trustResult.trustScore < 50 ? ['Low trust score'] : [],
      })

      // Check 4: Behavioral patterns
      if (userHistory) {
        const behavioralCheck = await detectAbuse(input.context.userId, userHistory)
        checks.push({
          name: 'Behavioral Patterns',
          passed: behavioralCheck.passed,
          score: behavioralCheck.score,
          issues: behavioralCheck.issues,
        })
      }

      // Agent makes autonomous decision
      return this.makeDecision(checks, trustResult.trustScore, spamCheck.spamScore)
    } catch (error) {
      console.error('Error in validation agent:', error)
      // On error, flag for review
      return {
        decision: 'flag_for_review',
        confidence: 0,
        reasons: ['Validation error occurred'],
        trustScore: 50,
        recommendedAction: 'Hold for manual review',
      }
    }
  }

  /**
   * Extract content text from item based on type
   */
  private extractContentText(item: any, itemType: 'rating' | 'resource' | 'user'): string {
    if (itemType === 'rating') {
      return item.comment || item.text || ''
    } else if (itemType === 'resource') {
      return `${item.name || ''} ${item.description || ''}`.trim()
    } else if (itemType === 'user') {
      return item.bio || item.description || ''
    }

    return ''
  }

  /**
   * Agent makes final decision autonomously
   */
  private makeDecision(
    checks: ValidationCheck[],
    trustScore: number,
    spamScore: number
  ): ValidationAgentOutput {
    const totalScore = checks.reduce((sum, c) => sum + c.score, 0) / checks.length
    const failedChecks = checks.filter((c) => !c.passed)

    let decision: 'approve' | 'reject' | 'flag_for_review'

    // Agent's decision logic:
    if (trustScore > 70 && totalScore > 80 && spamScore < 30) {
      // High trust user, good content, low spam
      decision = 'approve'
    } else if (trustScore < 30 || totalScore < 40 || spamScore >= 70) {
      // Low trust OR bad content OR high spam
      decision = 'reject'
    } else {
      // Uncertain - needs human review
      decision = 'flag_for_review'
    }

    const reasons = failedChecks.flatMap((c) => c.issues)

    return {
      decision,
      confidence: Math.round(totalScore),
      reasons,
      trustScore,
      recommendedAction: this.getRecommendedAction(decision, trustScore, totalScore),
      metadata: {
        spamScore,
        contentScore: checks.find((c) => c.name === 'Content Quality')?.score || 0,
        behavioralScore: checks.find((c) => c.name === 'Behavioral Patterns')?.score || 0,
        abuseLikelihood: spamScore > 50 ? spamScore : 0,
        timestamp: new Date().toISOString(),
      },
    }
  }

  /**
   * Get recommended action based on decision
   */
  private getRecommendedAction(
    decision: 'approve' | 'reject' | 'flag_for_review',
    trustScore: number,
    totalScore: number
  ): string {
    if (decision === 'approve') {
      return 'Auto-approve and publish'
    } else if (decision === 'reject') {
      return 'Auto-reject and notify user'
    } else {
      // Flag for review
      if (trustScore > 50 && totalScore > 60) {
        return 'Approve with monitoring'
      } else {
        return 'Hold for manual review'
      }
    }
  }
}

// Export singleton instance
export const validationAgent = new ValidationAgent()