import type { NextRequest } from 'next/server'
import { GET as loop } from '../route'

/**
 * /api/cron/service-loop/0 … /3: the service-adding loop, four times a day
 * (vercel.json: 00:15, 06:15, 12:15 and 18:15 UTC). Vercel's plan runs each
 * cron job at most once a day, and a job more often than that fails every
 * deploy (setup/RUNBOOK.md), so the four runs are four daily jobs. Each run
 * takes the slices for its six hours (lib/serviceLoop.ts, sliceFor), as one
 * job every six hours did.
 */
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return loop(req)
}

export const POST = GET
