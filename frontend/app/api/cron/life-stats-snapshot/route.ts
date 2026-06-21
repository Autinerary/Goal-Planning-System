import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAndComputeForUser } from '@/lib/life-stats/loader'

/**
 * POST /api/cron/life-stats-snapshot
 *
 * Recomputes Life Stats for every user who has been active in the last 30
 * days and upserts today's row in life_stats_snapshots. Runs once a day so
 * inactive users still have continuous snapshots (otherwise the trend
 * arrow can't tell "user dropped off" from "user never used the app").
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. We also
 * accept Vercel's own auto-set `x-vercel-cron` header. Local dev can use
 * the bearer if CRON_SECRET is set.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  // "Active in last 30 days" = any write to any user-keyed table we know about.
  // We union the user_ids and then run the pipeline once per unique id.
  const [calendarUsers, progressUsers, checkinUsers, snapshotUsers] = await Promise.all([
    admin.from('calendar_tasks').select('user_id').gte('updated_at', thirtyDaysAgoIso),
    admin.from('race_progress').select('user_id').gte('completed_at', thirtyDaysAgoIso),
    admin.from('life_stats_checkins').select('user_id').gte('created_at', thirtyDaysAgoIso),
    admin.from('life_stats_snapshots').select('user_id').gte('snapshot_date', thirtyDaysAgoIso.slice(0, 10)),
  ])

  const userIds = new Set<string>()
  for (const r of (calendarUsers.data ?? [])) userIds.add((r as any).user_id)
  for (const r of (progressUsers.data ?? [])) userIds.add((r as any).user_id)
  for (const r of (checkinUsers.data ?? [])) userIds.add((r as any).user_id)
  for (const r of (snapshotUsers.data ?? [])) userIds.add((r as any).user_id)

  let succeeded = 0
  let failed = 0
  // Run sequentially to avoid hammering Supabase + serverless concurrency limits.
  // ~50ms-ish per user; 200 users = 10s, well within Vercel's 300s cron budget.
  for (const userId of userIds) {
    try {
      await loadAndComputeForUser(admin, userId, now)
      succeeded++
    } catch (err: any) {
      failed++
      console.error(`life-stats snapshot failed for ${userId}:`, err?.message ?? err)
    }
  }

  return NextResponse.json({
    asOf: now.toISOString(),
    totalUsers: userIds.size,
    succeeded,
    failed,
  })
}

/** Vercel Cron only runs GETs by default; allow that too. */
export const GET = POST

function isAuthorized(req: NextRequest): boolean {
  // Vercel sets this header on cron invocations automatically.
  if (req.headers.get('x-vercel-cron') === '1') return true

  const expected = process.env.CRON_SECRET
  if (!expected) {
    // Missing secret = refuse, otherwise the endpoint is a public DoS vector.
    return false
  }
  const got = req.headers.get('authorization') ?? ''
  return got === `Bearer ${expected}`
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — covers a few hundred users
