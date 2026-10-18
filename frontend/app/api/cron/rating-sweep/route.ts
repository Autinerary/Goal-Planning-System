import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cronAuthorized } from '@/lib/cronAuth'
import { emailEnabled, ratingSweepDigestEmail, sendEmail, serviceStandingEmail, type SweepRow } from '@/lib/email'
import { postalAddress } from '@/lib/newsletter'
import { PROOF_EMAIL } from '@/lib/legal'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'https://servicehub-six.vercel.app').replace(/\/$/, '')

/**
 * GET /api/cron/rating-sweep: the monthly rating sweep (the team's planning
 * note, October 2026, Goal 5: "Vote out the Worst (monthly, rating sweep)";
 * vercel.json, the 1st). The database does it (STEP 79's rating_sweep()):
 * under 4.0 warned; 3.5 or under, two months' probation; still so, hidden;
 * back above 3.5, restored. Nothing is deleted.
 *
 * The team gets a digest of every service at 3.5 or under (RATING_SWEEP_TO,
 * else heydevs@autinerary.ca). Services are emailed about a change at the
 * address they publish (the team turned this on, 18 October 2026);
 * RATING_SWEEP_EMAIL_SERVICES=off stops it.
 * ?dry=1 changes and sends nothing to services, and says what would happen.
 */
async function run(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('rating_sweep', { p_apply: !dry })
  if (error) {
    const note = error.code === 'PGRST202' ? 'Apply STEP 79 first.' : error.message
    console.error('[rating-sweep]', note)
    return NextResponse.json({ ok: false, error: note }, { status: error.code === 'PGRST202' ? 200 : 500 })
  }
  const rows = (data || []) as SweepRow[]
  const toServices = !dry && process.env.RATING_SWEEP_EMAIL_SERVICES !== 'off' && emailEnabled()
  const postal = postalAddress()
  const failures: string[] = []
  let emailed = 0
  if (toServices) {
    for (const r of rows) {
      if (r.from_state === r.to_state || !r.email_ok || !r.email) continue
      const mail = serviceStandingEmail(r, HUB, postal)
      if (!mail) continue
      const res = await sendEmail({
        to: r.email,
        ...mail,
        from: process.env.REMINDER_FROM_EMAIL || undefined,
        idempotencyKey: `sweep-${r.resource_id}-${r.to_state}-${new Date().toISOString().slice(0, 7)}`,
      })
      if (res.ok) emailed++
      else if (!res.skipped) failures.push(`${r.resource_id}: ${res.error}`)
    }
  }
  let digest = false
  if (emailEnabled() && rows.length > 0) {
    const mail = ratingSweepDigestEmail(rows, HUB, !dry, emailed)
    const res = await sendEmail({ to: process.env.RATING_SWEEP_TO || PROOF_EMAIL, ...mail, idempotencyKey: `sweep-digest-${new Date().toISOString().slice(0, 10)}${dry ? '-dry' : ''}` })
    digest = res.ok
    if (!res.ok && !res.skipped) failures.push(`digest: ${res.error}`)
  }
  const summary = {
    ok: true,
    dry,
    services: rows.length,
    changed: rows.filter((r) => r.from_state !== r.to_state).length,
    atOrUnder35: rows.filter((r) => r.to_state === 'probation' || r.to_state === 'hidden').length,
    hidden: rows.filter((r) => r.to_state === 'hidden').length,
    servicesEmailed: emailed,
    digest,
    failures: failures.slice(0, 10),
  }
  console.log('[rating-sweep]', JSON.stringify(summary))
  return NextResponse.json(summary)
}

export const GET = run
export const POST = run
