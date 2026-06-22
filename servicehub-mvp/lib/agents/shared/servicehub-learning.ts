/**
 * ServiceHub universal agent learning loop.
 *
 * Closes the bandit feedback loop for the four agents that did NOT already
 * have one (pattern, validation, synthesis, orchestrator). The
 * recommendation-agent already learns through the shared `tool_outcomes`
 * table from `2026_universal_agent_learning.sql`; this module covers the
 * rest.
 *
 *                ┌─ pattern agent ─────────┐
 *                ├─ validation agent ──────┤
 *  agent.run() ──┤                         ├──► recordAgentDecision()
 *                ├─ synthesis engine ──────┤      writes (user, resource,
 *                └─ orchestrator ──────────┘      agent, decision_key)
 *
 *                                                ┌──► getAgentScores()
 *                                                │     reads back the bandit
 *                                                │     aggregate, agent
 *                                                │     uses the scores to
 *                                                │     re-rank/bias its next
 *                                                │     decision.
 *
 *  ratings POST ────────────────────────────────► attributeReward()
 *                                                  one RPC fans the reward
 *                                                  out to every in-window
 *                                                  decision across all four
 *                                                  agents.
 *
 * Backend by Supabase. No new infra. Best-effort: every call no-ops when
 * the service-role key isn't configured.
 *
 * Migration: servicehub-mvp/scripts/2026_servicehub_agent_learning.sql
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type ServiceHubAgentName =
  | 'pattern'
  | 'validation'
  | 'synthesis'
  | 'orchestrator'

export interface AgentDecisionInput {
  agent: ServiceHubAgentName
  decisionKey: string
  userId?: string | null
  resourceId?: string | null
  confidence?: number
}

export interface AgentScore {
  decisionKey: string
  rewardAvg: number
  rewardCount: number
}

// ---------------------------------------------------------------------------
// Service-role client (server-side only). Mirrors recommendation-agent/memory.
// ---------------------------------------------------------------------------

let cached: SupabaseClient | null | undefined

function getServiceClient(): SupabaseClient | null {
  if (cached !== undefined) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    cached = null
    return null
  }
  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}

// ---------------------------------------------------------------------------
// Decision-key builders. Each agent has its own stable shape so we don't
// accidentally aggregate across totally different decision spaces.
// ---------------------------------------------------------------------------

/**
 * Pattern agent: keyed by (pattern_type, sorted_signature_csv).
 *   barrier_combination|adhd:focus,autism:sensory
 *   resource_affinity|res-uuid-a,res-uuid-b
 *   intersectionality|adhd,female,low-income
 */
export function buildPatternKey(patternType: string, signature: string[] | string): string {
  const arr = Array.isArray(signature)
    ? signature
    : String(signature || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
  const sorted = [...new Set(arr.map((s) => s.toLowerCase()))].sort().join(',')
  return `${String(patternType || 'unknown').toLowerCase()}|${sorted}`
}

/**
 * Validation agent: keyed by (decision, trust_bucket, spam_bucket, len_bucket).
 *   approve|trust:hi|spam:lo|len:md
 *   flag_for_review|trust:lo|spam:hi|len:sh
 */
function bucket(value: number | null | undefined, edges: [number, number]): string {
  const v = Number.isFinite(value as number) ? (value as number) : 0
  if (v < edges[0]) return 'lo'
  if (v < edges[1]) return 'md'
  return 'hi'
}

function lenBucket(text: string | null | undefined): string {
  const n = (text || '').length
  if (n < 50) return 'sh'
  if (n < 250) return 'md'
  return 'lg'
}

export function buildValidationKey(args: {
  decision: 'approve' | 'reject' | 'flag_for_review'
  trustScore?: number
  spamScore?: number
  contentText?: string
}): string {
  return [
    args.decision,
    `trust:${bucket(args.trustScore, [40, 70])}`,
    `spam:${bucket(args.spamScore, [30, 60])}`,
    `len:${lenBucket(args.contentText)}`,
  ].join('|')
}

/**
 * Synthesis engine: keyed by (request_type, strategy_slug).
 *   recommendations|weighted_blend
 *   search|semantic_rerank
 */
export function buildSynthesisKey(requestType: string, strategy: string): string {
  return `${String(requestType || 'unknown').toLowerCase()}|${String(strategy || 'default')
    .toLowerCase()
    .replace(/\s+/g, '_')}`
}

/**
 * Orchestrator: keyed by (request_type, sorted_agent_set_csv).
 *   recommendations|pattern,recommendation,validation
 *   search|recommendation
 */
export function buildOrchestratorKey(requestType: string, agentSet: string[]): string {
  const sorted = [...new Set((agentSet || []).map((a) => String(a).toLowerCase()))].sort().join(',')
  return `${String(requestType || 'unknown').toLowerCase()}|${sorted}`
}

// ---------------------------------------------------------------------------
// Write path: record a decision. Fire-and-forget — never throws into agents.
// ---------------------------------------------------------------------------

export async function recordAgentDecision(input: AgentDecisionInput): Promise<boolean> {
  const client = getServiceClient()
  if (!client || !input.decisionKey) return false

  try {
    const { error } = await client.from('servicehub_agent_decisions').insert({
      user_id: input.userId || null,
      resource_id: input.resourceId || null,
      agent_name: input.agent,
      decision_key: input.decisionKey,
      confidence: Number.isFinite(input.confidence as number)
        ? (input.confidence as number)
        : null,
    })
    if (error) {
      console.warn('[servicehub-learning] recordAgentDecision skipped:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[servicehub-learning] recordAgentDecision failed:', err)
    return false
  }
}

/**
 * Convenience batch writer when an agent makes multiple decisions in one
 * call (e.g. pattern-agent surfacing 10 patterns).
 */
export async function recordAgentDecisions(decisions: AgentDecisionInput[]): Promise<number> {
  if (!decisions.length) return 0
  const client = getServiceClient()
  if (!client) return 0

  const rows = decisions
    .filter((d) => d && d.decisionKey)
    .map((d) => ({
      user_id: d.userId || null,
      resource_id: d.resourceId || null,
      agent_name: d.agent,
      decision_key: d.decisionKey,
      confidence: Number.isFinite(d.confidence as number) ? (d.confidence as number) : null,
    }))
  if (!rows.length) return 0

  try {
    const { error } = await client.from('servicehub_agent_decisions').insert(rows)
    if (error) {
      console.warn('[servicehub-learning] recordAgentDecisions skipped:', error.message)
      return 0
    }
    return rows.length
  } catch (err) {
    console.warn('[servicehub-learning] recordAgentDecisions failed:', err)
    return 0
  }
}

// ---------------------------------------------------------------------------
// Read path: pull reward scores for a set of candidate decision_keys.
// ---------------------------------------------------------------------------

export async function getAgentScores(
  agent: ServiceHubAgentName,
  decisionKeys: string[],
  minSamples = 1
): Promise<Map<string, AgentScore>> {
  const out = new Map<string, AgentScore>()
  if (!decisionKeys.length) return out
  const client = getServiceClient()
  if (!client) return out

  try {
    const { data, error } = await client.rpc('get_servicehub_agent_scores', {
      p_agent_name: agent,
      p_decision_keys: decisionKeys,
      p_min_samples: minSamples,
    })
    if (error) {
      console.warn('[servicehub-learning] getAgentScores skipped:', error.message)
      return out
    }
    for (const row of (data as Array<{ decision_key: string; reward_avg: number; reward_count: number }>) || []) {
      if (row && row.decision_key) {
        out.set(row.decision_key, {
          decisionKey: row.decision_key,
          rewardAvg: Number(row.reward_avg) || 0,
          rewardCount: Number(row.reward_count) || 0,
        })
      }
    }
    return out
  } catch (err) {
    console.warn('[servicehub-learning] getAgentScores failed:', err)
    return out
  }
}

// ---------------------------------------------------------------------------
// Attribution: called from ratings route. One RPC fans the reward out to
// every in-window decision touching (user, resource) across all four agents.
// ---------------------------------------------------------------------------

/**
 * Convert a 1-5 star rating into the same [-1, +1] reward signal that
 * recommendation-agent/memory.ts uses, so all of ServiceHub's learning
 * loops share the exact same reward scale.
 *
 *   5 → +1.0      3 → 0.0 (no-op)      1 → -1.0
 */
export function ratingToReward(overall1to5: number): number {
  if (!Number.isFinite(overall1to5)) return 0
  const clamped = Math.max(1, Math.min(5, overall1to5))
  return (clamped - 3) / 2
}

export async function attributeReward(
  userId: string | null | undefined,
  resourceId: string | null | undefined,
  reward: number,
  windowDays = 30
): Promise<number> {
  if (!userId || !resourceId) return 0
  if (!Number.isFinite(reward) || reward === 0) return 0
  const client = getServiceClient()
  if (!client) return 0

  try {
    const { data, error } = await client.rpc('attribute_servicehub_reward', {
      p_user_id: userId,
      p_resource_id: resourceId,
      p_reward: reward,
      p_window_days: windowDays,
    })
    if (error) {
      console.warn('[servicehub-learning] attributeReward skipped:', error.message)
      return 0
    }
    return Number(data) || 0
  } catch (err) {
    console.warn('[servicehub-learning] attributeReward failed:', err)
    return 0
  }
}
