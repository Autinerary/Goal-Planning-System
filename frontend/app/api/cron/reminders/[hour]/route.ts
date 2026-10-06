import { NextRequest } from 'next/server'
import { handleReminderRun } from '@/lib/reminderRun'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/reminders/<hour>: the same run as /api/cron/reminders. One
 * Vercel Cron job per UTC hour calls it (vercel.json); the hour in the path
 * only tells the jobs apart, and the run works from the actual time.
 */
export async function GET(req: NextRequest) {
  return handleReminderRun(req)
}
