/**
 * Data loaders + assembly for Life Stats.
 *
 * - `loadAndComputeForUser` pulls every signal we need from Supabase for one
 *   user, runs the pure compute functions, upserts today's snapshot, and
 *   returns the API-shape payload (including the trend arrow).
 *
 * Both the GET endpoint (cookie auth) and the cron job (service-role) call
 * this. The caller supplies the Supabase client so RLS context is correct.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCommitment,
  computeEnergy,
  computeFocus,
  computeHappiness,
  computeMentality,
  type ActivityPing,
  type CalendarRow,
  type CheckinRow,
  type HappinessResult,
  type MilestoneEvent,
  type ReflectionRow,
  type SocialEvent,
  type StatComponents,
} from './compute'

const MS_PER_DAY = 86_400_000

export interface StatResponse extends StatComponents {
  /** Today's value out of 10 (rounded to 1 decimal). UI-friendly. */
  value: number
  /**
   * change = today_value - value_seven_days_ago, in the same 0..10 space.
   * null when no baseline exists (e.g. user with <7 days of snapshots).
   */
  change: number | null
}

export interface LifeStatsPayload {
  asOf: string                // ISO date YYYY-MM-DD
  stats: {
    mentality: StatResponse
    happiness: StatResponse & { source: 'checkin' | 'inferred' }
    focus: StatResponse
    energy: StatResponse
    /** Null until the account has enough history to judge — not a zero. */
    commitment: StatResponse | null
  }
  /** True if user already submitted a mood check-in for today. */
  checkinPromptedToday: boolean
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function sevenDaysAgo(now: Date): Date {
  return new Date(now.getTime() - 7 * MS_PER_DAY)
}

/** Commitment looks back four weeks, so it needs its own, wider fetch. */
function twentyEightDaysAgo(now: Date): Date {
  return new Date(now.getTime() - 28 * MS_PER_DAY)
}

function toResponse(s: StatComponents, baseline: number | null): StatResponse {
  const value = Math.round((s.score / 10) * 10) / 10
  const change = baseline === null
    ? null
    : Math.round((s.score - baseline) / 10 * 10) / 10
  return { ...s, value, change }
}

/**
 * Run the full pipeline for one user.
 *
 * The supplied Supabase client controls RLS context:
 *  - cookie-auth client (createServerSupabase) for the user's own GET request
 *  - service-role client for the nightly cron
 */
export async function loadAndComputeForUser(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<LifeStatsPayload> {
  const weekAgo = sevenDaysAgo(now)
  const weekAgoIso = weekAgo.toISOString()
  const weekAgoDay = dayKey(weekAgo)
  const todayDay = dayKey(now)
  const monthAgo = twentyEightDaysAgo(now)
  const monthAgoIso = monthAgo.toISOString()
  const monthAgoDay = dayKey(monthAgo)

  // Fetch every signal in parallel. Errors fall back to empty arrays
  // so a single bad query doesn't 500 the whole endpoint.
  const [
    calendarRes,
    progressRes,
    reflectionsRes,
    checkinsRes,
    connectionsRes,
    suggestionsToMeRes,
    suggestionsFromMeRes,
    todaysCheckinRes,
    baselineSnapRes,
    monthMilestonesRes,
    monthCheckinsRes,
    monthTasksRes,
  ] = await Promise.all([
    supabase
      .from('calendar_tasks')
      .select('day, completed, completed_at, created_at')
      .eq('user_id', userId)
      .gte('day', weekAgoDay),

    supabase
      .from('race_progress')
      .select('completed_at, kind')
      .eq('user_id', userId)
      .eq('kind', 'completed')
      .gte('completed_at', weekAgoIso),

    // Will return [] today (reflections aren't persisted yet) — compute lib
    // handles that gracefully.
    supabase
      .from('reflections')
      .select('created_at, sentiment')
      .eq('user_id', userId)
      .gte('created_at', weekAgoIso),

    supabase
      .from('life_stats_checkins')
      .select('checkin_date, mood, created_at')
      .eq('user_id', userId)
      .gte('checkin_date', weekAgoDay),

    supabase
      .from('social_connections')
      .select('updated_at, status')
      .eq('owner_id', userId)
      .eq('status', 'connected')
      .gte('updated_at', weekAgoIso),

    supabase
      .from('service_suggestions')
      .select('created_at')
      .eq('to_user_id', userId)
      .gte('created_at', weekAgoIso),

    supabase
      .from('service_suggestions')
      .select('created_at')
      .eq('from_user_id', userId)
      .gte('created_at', weekAgoIso),

    supabase
      .from('life_stats_checkins')
      .select('checkin_date')
      .eq('user_id', userId)
      .eq('checkin_date', todayDay)
      .maybeSingle(),

    supabase
      .from('life_stats_snapshots')
      .select('mentality, happiness, focus, energy, commitment')
      .eq('user_id', userId)
      .eq('snapshot_date', weekAgoDay)
      .maybeSingle(),

    // 28-day signals for Commitment. Separate queries rather than widening the
    // 7-day ones, so the other stats keep their window exactly.
    supabase
      .from('race_progress')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('kind', 'completed')
      .gte('completed_at', monthAgoIso),

    supabase
      .from('life_stats_checkins')
      .select('checkin_date')
      .eq('user_id', userId)
      .gte('checkin_date', monthAgoDay),

    supabase
      .from('calendar_tasks')
      .select('completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', monthAgoIso),
  ])

  // ---- Reshape rows for the pure compute functions ----

  const calendarRows: CalendarRow[] = (calendarRes.data ?? []).map((r: any) => ({
    // day is stored as a free-form text in this app; parse loosely.
    day: new Date(String(r.day)),
    completed: Boolean(r.completed),
    completedAt: r.completed_at ? new Date(r.completed_at) : null,
  }))

  const milestoneEvents: MilestoneEvent[] = (progressRes.data ?? []).map((r: any) => ({
    completedAt: new Date(r.completed_at),
  }))

  const sentimentMap: Record<string, number> = { positive: 1, neutral: 0, negative: -1 }
  const reflectionRows: ReflectionRow[] = (reflectionsRes.data ?? []).map((r: any) => ({
    createdAt: new Date(r.created_at),
    sentiment: r.sentiment in sentimentMap ? sentimentMap[r.sentiment] : null,
  }))

  const checkinRows: CheckinRow[] = (checkinsRes.data ?? []).map((r: any) => ({
    checkinDate: new Date(String(r.checkin_date)),
    mood: Number(r.mood),
  }))

  const socialEvents: SocialEvent[] = [
    ...((connectionsRes.data ?? []).map((r: any) => ({
      occurredAt: new Date(r.updated_at),
      type: 'connection_accepted',
    }))),
    ...((suggestionsToMeRes.data ?? []).map((r: any) => ({
      occurredAt: new Date(r.created_at),
      type: 'suggestion_received',
    }))),
    ...((suggestionsFromMeRes.data ?? []).map((r: any) => ({
      occurredAt: new Date(r.created_at),
      type: 'suggestion_sent',
    }))),
  ]

  // Activity pings = any timestamp that says "user did something today".
  const activityPings: ActivityPing[] = [
    ...calendarRows.filter((c) => c.completedAt).map((c) => ({ occurredAt: c.completedAt as Date })),
    ...milestoneEvents.map((m) => ({ occurredAt: m.completedAt })),
    ...checkinRows.map((c) => ({ occurredAt: c.checkinDate })),
    ...reflectionRows.map((r) => ({ occurredAt: r.createdAt })),
    ...socialEvents.map((s) => ({ occurredAt: s.occurredAt })),
  ]

  // ---- Compute ----

  const focus     = computeFocus(calendarRows, milestoneEvents, now)
  const energy    = computeEnergy(activityPings, now)
  const mentality = computeMentality(reflectionRows, milestoneEvents, /*barrierCount*/ 0, now)
  const happiness = computeHappiness(checkinRows, reflectionRows, socialEvents, now)

  // Commitment reads its own 28-day pings. Only signals the app actually
  // writes are used — milestone completions and check-ins are recorded today,
  // so the score reflects real behaviour rather than an empty column.
  const monthMilestones: MilestoneEvent[] = (monthMilestonesRes.data ?? []).map((r: any) => ({
    completedAt: new Date(r.completed_at),
  }))
  const monthPings: ActivityPing[] = [
    ...monthMilestones.map((m) => ({ occurredAt: m.completedAt })),
    ...((monthCheckinsRes.data ?? []).map((r: any) => ({ occurredAt: new Date(String(r.checkin_date)) }))),
    ...((monthTasksRes.data ?? []).map((r: any) => ({ occurredAt: new Date(r.completed_at) }))),
  ]
  const commitment = computeCommitment(monthPings, monthMilestones, now)

  // ---- Trend baselines ----

  const baseline = baselineSnapRes.data
  const baselineFocus     = baseline?.focus     ?? null
  const baselineEnergy    = baseline?.energy    ?? null
  const baselineMentality = baseline?.mentality ?? null
  const baselineHappiness = baseline?.happiness ?? null
  const baselineCommitment = baseline?.commitment ?? null

  // ---- Upsert today's snapshot ----
  // We re-upsert on every request — cheap and keeps the "today" value fresh
  // as the user does things during the day.
  await supabase
    .from('life_stats_snapshots')
    .upsert(
      {
        user_id: userId,
        snapshot_date: todayDay,
        mentality: mentality.score,
        happiness: happiness.score,
        focus: focus.score,
        energy: energy.score,
        commitment: commitment ? commitment.score : null,
        happiness_source: happiness.source,
        computed_at: now.toISOString(),
      },
      { onConflict: 'user_id,snapshot_date' }
    )

  return {
    asOf: todayDay,
    stats: {
      mentality: toResponse(mentality, baselineMentality),
      happiness: { ...toResponse(happiness, baselineHappiness), source: happiness.source },
      focus:     toResponse(focus, baselineFocus),
      energy:    toResponse(energy, baselineEnergy),
      commitment: commitment ? toResponse(commitment, baselineCommitment) : null,
    },
    checkinPromptedToday: Boolean(todaysCheckinRes.data),
  }
}
