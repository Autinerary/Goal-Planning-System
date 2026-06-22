/**
 * Recommendation Agent memory store.
 *
 * Gives the RecommendationAgent persistent, cross-session memory of a user so
 * it can build on what it recommended before instead of starting fresh on every
 * login. Backed by the shared Supabase project (table:
 * public.recommendation_memory).
 *
 * Best-effort by design: when the service-role key isn't configured or a query
 * fails, every function degrades gracefully to a no-op / empty result so the
 * agent keeps working. Mirrors backend/core/memory.py in the Goal Planning System.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  RecommendationAgentInput,
  RecommendationAgentOutput,
  Barrier,
} from './types'

// How many recent runs to surface back to the agent.
const RECENT_LIMIT = 5

export interface RecommendationRunSummary {
  timestamp: string
  barriers: string[] // barrier types, e.g. ["adhd", "autism"]
  context?: string
  topResources: string[] // names of the top recommended resources
  confidence: number
}

export interface RecommendationMemory {
  runCount: number
  recentRuns: RecommendationRunSummary[] // newest first
  lastBarriers: string[]
  lastTopResources: string[]
}

const EMPTY_MEMORY: RecommendationMemory = {
  runCount: 0,
  recentRuns: [],
  lastBarriers: [],
  lastTopResources: [],
}

let _client: SupabaseClient | null = null

/** Service-role client that returns null (instead of throwing) when unconfigured. */
function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (_client) return _client
  try {
    _client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    return _client
  } catch (err) {
    console.warn('[recommendation-memory] client init failed:', err)
    return null
  }
}

function compactSummary(
  input: RecommendationAgentInput,
  output: RecommendationAgentOutput
): RecommendationRunSummary {
  const topResources = (output.resources || [])
    .slice(0, 8)
    .map((r: any) => r.name || r.resource_name || '')
    .filter((n: string) => n)

  return {
    timestamp: new Date().toISOString(),
    barriers: (input.barriers || []).map((b: Barrier) => b.type),
    context: input.context,
    topResources,
    confidence: output.confidence ?? 0,
  }
}

/** Return a compact memory object for a user. Always returns a valid shape. */
export async function loadUserMemory(userId: string): Promise<RecommendationMemory> {
  if (!userId) return EMPTY_MEMORY
  const client = getServiceClient()
  if (!client) return EMPTY_MEMORY

  try {
    const { data, error } = await client
      .from('recommendation_memory')
      .select('summary, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT)

    if (error) {
      console.warn('[recommendation-memory] load skipped:', error.message)
      return EMPTY_MEMORY
    }

    const rows = data || []
    if (rows.length === 0) return EMPTY_MEMORY

    const recentRuns = rows
      .map((r: any) => r.summary as RecommendationRunSummary)
      .filter(Boolean)
    const last = recentRuns[0]

    return {
      runCount: recentRuns.length,
      recentRuns,
      lastBarriers: last?.barriers || [],
      lastTopResources: last?.topResources || [],
    }
  } catch (err) {
    console.warn('[recommendation-memory] load failed:', err)
    return EMPTY_MEMORY
  }
}

/** Append a compact summary of a recommendation run to the user's memory log. */
export async function recordRun(
  userId: string,
  input: RecommendationAgentInput,
  output: RecommendationAgentOutput
): Promise<void> {
  if (!userId) return
  const client = getServiceClient()
  if (!client) return

  try {
    const summary = compactSummary(input, output)
    const { error } = await client
      .from('recommendation_memory')
      .insert({ user_id: userId, summary })
    if (error) {
      console.warn('[recommendation-memory] record skipped:', error.message)
    }
  } catch (err) {
    console.warn('[recommendation-memory] record failed:', err)
  }
}

/**
 * Render memory as a short natural-language block for the explanation LLM.
 * Returns '' when there's no useful history so callers can cheaply skip it.
 */
export function summarizeForPrompt(memory: RecommendationMemory | null): string {
  if (!memory || memory.recentRuns.length === 0) return ''

  const runs = memory.recentRuns
  const lines: string[] = [
    `This user has ${runs.length} prior recommendation session(s). ` +
      `Build on this history; favor continuity and avoid re-pitching resources they've already seen.`,
  ]
  runs.slice(0, 3).forEach((run, i) => {
    const barriers = run.barriers.join(', ') || 'n/a'
    const resources = run.topResources.join('; ') || 'n/a'
    lines.push(`Session ${i + 1}: barriers=[${barriers}]. Previously suggested: ${resources}`)
  })
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Shared cross-product learning loop: `tool_outcomes` table.
//
// This table is written from BOTH:
//   * goal-planning-system reflection route (when a user reflects on a path
//     that included these resources), and
//   * servicehub-mvp ratings flow (when a user rates a resource directly).
//
// It is READ from BOTH:
//   * goal-planning-system tool_recommendation_agent, and
//   * servicehub-mvp recommendation-agent scorer.
//
// Migration: backend/database/migrations/2026_universal_agent_learning.sql
// ---------------------------------------------------------------------------

/**
 * Convert a 1-5 star rating into a [-1, 1] reward signal.
 *  5 → +1.0     (loved it)
 *  4 → +0.5     (helpful)
 *  3 →  0.0     (neutral, ignored)
 *  2 → -0.5     (not helpful)
 *  1 → -1.0     (actively bad)
 */
function ratingToReward(overall1to5: number): number {
  if (!Number.isFinite(overall1to5)) return 0
  const clamped = Math.max(1, Math.min(5, overall1to5))
  return (clamped - 3) / 2
}

/**
 * Record a single rating as a reward attribution against the resource +
 * barriers it was given for. Best-effort: silently no-ops when Supabase
 * isn't configured. Skips ratings of exactly 3 (no learning signal).
 */
export async function recordRatingOutcome(
  resourceId: string,
  barriers: string[],
  overallRating1to5: number
): Promise<boolean> {
  if (!resourceId) return false
  const reward = ratingToReward(overallRating1to5)
  if (reward === 0) return false // neutral ratings carry no signal

  const client = getServiceClient()
  if (!client) return false

  try {
    const cleanedBarriers = (barriers || [])
      .map((b) => String(b || '').trim().toLowerCase())
      .filter((b) => b.length > 0)
    const { error } = await client.rpc('record_tool_outcomes', {
      tool_ids_in: [resourceId],
      barriers_in: cleanedBarriers,
      reward_in: reward,
    })
    if (error) {
      console.warn('[recommendation-memory] recordRatingOutcome skipped:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[recommendation-memory] recordRatingOutcome failed:', err)
    return false
  }
}

/**
 * Pull learned per-tool reward scores for the user's barriers. Returns an
 * empty Map when Supabase isn't configured / no data yet — the scorer
 * treats that as "no learned signal, use static factors only".
 */
export async function getToolOutcomeScores(
  barriers: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const client = getServiceClient()
  if (!client) return out

  try {
    const cleanedBarriers = (barriers || [])
      .map((b) => String(b || '').trim().toLowerCase())
      .filter((b) => b.length > 0)
    const { data, error } = await client.rpc('get_tool_outcome_scores', {
      barriers_in: cleanedBarriers.length > 0 ? cleanedBarriers : null,
      min_samples: 2,
    })
    if (error) {
      console.warn('[recommendation-memory] getToolOutcomeScores skipped:', error.message)
      return out
    }
    for (const row of data || []) {
      if (row && row.tool_id) {
        const avg = Number(row.reward_avg)
        if (Number.isFinite(avg)) {
          out.set(String(row.tool_id), avg)
        }
      }
    }
    return out
  } catch (err) {
    console.warn('[recommendation-memory] getToolOutcomeScores failed:', err)
    return out
  }
}
