import { NextRequest } from 'next/server'
import { handleReminderRun } from '@/lib/reminderRun'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/reminders: one run of the reminder send (lib/reminderRun.ts).
 *
 * Vercel Cron calls /api/cron/reminders/<hour> once a day for each hour of
 * the day (vercel.json), which is what an hourly send looks like on Vercel's
 * Hobby plan, where each job may run only once a day. Each run sends the
 * daily reminders whose chosen time it is in their owner's time zone, and
 * any reminder to finish setup that is due. This path does the same, for
 * running it by hand. Vercel sends `Authorization: Bearer <CRON_SECRET>`; it
 * is required when CRON_SECRET is set.
 */
export async function GET(req: NextRequest) {
  return handleReminderRun(req)
}
