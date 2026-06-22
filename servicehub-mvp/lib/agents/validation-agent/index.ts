import { validateContent } from './content-validator'
import { detectSpam } from './spam-detector'
import { calculateUserTrust, getUserHistory } from './trust-scorer'
import { detectAbuse } from './abuse-detector'
import {
  buildValidationKey,
  getAgentScores,
  recordAgentDecision,
} from '@/lib/agents/shared/servicehub-learning'
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

      // Agent makes autonomous decision based on the rules.
      const ruleDecision = this.makeDecision(
        checks,
        trustResult.trustScore,
        spamCheck.spamScore
      )

      // Bandit refinement: if this (trust, spam, length) bucket has
      // strong learned evidence that the opposite call is better, flip
      // gray-zone decisions. Conservative — we only flip flag_for_review,
      // never override a clear approve/reject from the rule set.
      // contentText already extracted above for the spam check; reuse it.
      const finalDecision = await this.refineWithBandit(
        ruleDecision,
        trustResult.trustScore,
        spamCheck.spamScore,
        contentText
      )

      // Fire-and-forget trace write. Resource_id is only set for ratings
      // (where item.resource_id exists), which is what the ratings-route
      // attribution path keys on. For resource/user submissions we just
      // log the decision without a resource binding.
      const resourceId =
        input.itemType === 'rating'
          ? (input.item?.resource_id as string | undefined) || null
          : input.itemType === 'resource'
          ? (input.item?.id as string | undefined) || null
          : null

      try {
        await recordAgentDecision({
          agent: 'validation',
          decisionKey: buildValidationKey({
            decision: finalDecision.decision,
            trustScore: trustResult.trustScore,
            spamScore: spamCheck.spamScore,
            contentText,
          }),
          userId: input.context.userId,
          resourceId,
          confidence: finalDecision.confidence,
        })
      } catch (err) {
        console.warn('[validation-agent] decision trace skipped:', err)
      }

      return finalDecision
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
   * Bandit-based refinement of a rule-based decision. Only ever changes a
   * `flag_for_review` into a clearer call — never overrides an explicit
   * approve/reject. Returns the (possibly modified) decision.
   */
  private async refineWithBandit(
    ruleDecision: ValidationAgentOutput,
    trustScore: number,
    spamScore: number,
    contentText: string
  ): Promise<ValidationAgentOutput> {
    if (ruleDecision.decision !== 'flag_for_review') return ruleDecision

    try {
      const approveKey = buildValidationKey({
        decision: 'approve',
        trustScore,
        spamScore,
        contentText,
      })
      const rejectKey = buildValidationKey({
        decision: 'reject',
        trustScore,
        spamScore,
        contentText,
      })
      const scores = await getAgentScores(
        'validation',
        [approveKey, rejectKey],
        3 // need at least 3 historical observations before we trust the signal
      )
      const approveAvg = scores.get(approveKey)?.rewardAvg ?? 0
      const rejectAvg = scores.get(rejectKey)?.rewardAvg ?? 0

      // Strong positive history on approve in this bucket → upgrade.
      if (approveAvg >= 0.4 && approveAvg - rejectAvg > 0.5) {
        return {
          ...ruleDecision,
          decision: 'approve',
          reasons: [...ruleDecision.reasons, 'Bandit: similar approvals scored well'],
          recommendedAction: 'Auto-approve based on learned bucket history',
        }
      }
      // Strong negative history on approve in this bucket → downgrade to reject.
      if (rejectAvg >= 0.4 && rejectAvg - approveAvg > 0.5) {
        return {
          ...ruleDecision,
          decision: 'reject',
          reasons: [
            ...ruleDecision.reasons,
            'Bandit: similar approvals scored badly historically',
          ],
          recommendedAction: 'Auto-reject based on learned bucket history',
        }
      }
    } catch (err) {
      console.warn('[validation-agent] bandit refinement skipped:', err)
    }
    return ruleDecision
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