import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cronAuthorized } from '@/lib/cronAuth'
import { choiceTallyEmail, emailEnabled, sendEmail } from '@/lib/email'
import { monthName, previousMonth, torontoMonth } from '@/lib/choiceTime'
import { CHOICE_KINDS } from '@/lib/communityChoice'
import { PROOF_EMAIL } from '@/lib/legal'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'https://servicehub-six.vercel.app').replace(/\/$/, '')

/**
 * GET /api/cron/choice-tally: the month's Community's Choice winners (Goal 5:
 * "Tally up votes at end of month"; vercel.json, the 1st, after midnight in
 * Toronto). The database counts (STEP 79's choice_tally()): the most votes
 * of each kind wins, ties to the most nominated; winners are saved and
 * tagged community_choice. The team gets the result. ?dry=1 saves nothing;
 * ?month=YYYY-MM tallies another month (once only, as the database makes it).
 */
async function run(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const asked = req.nextUrl.searchParams.get('month') || ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : previousMonth(torontoMonth(new Date()))
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('choice_tally', { p_month: month, p_apply: !dry })
  if (error) {
    const note = error.code === 'PGRST202' ? 'Apply STEP 79 first.' : error.message
    console.error('[choice-tally]', note)
    return NextResponse.json({ ok: false, error: note }, { status: error.code === 'PGRST202' ? 200 : 500 })
  }
  const winners = ((data || []) as { kind: string; item_id: string; name: string; votes: number }[]).map((w) => ({
    kind: CHOICE_KINDS.find((k) => k.id === w.kind)?.label || w.kind,
    name: w.name,
    votes: w.votes,
    url: w.kind === 'product' ? `${HUB}/shop/${w.item_id}` : `${HUB}/resources/${w.item_id}`,
  }))
  let told = false
  if (emailEnabled()) {
    const mail = choiceTallyEmail(monthName(month, true), winners, !dry)
    const res = await sendEmail({ to: process.env.RATING_SWEEP_TO || PROOF_EMAIL, ...mail, idempotencyKey: `choice-tally-${month}${dry ? '-dry' : ''}` })
    told = res.ok
  }
  const summary = { ok: true, dry, month, winners: winners.length, told }
  console.log('[choice-tally]', JSON.stringify(summary))
  return NextResponse.json(summary)
}

export const GET = run
export const POST = run
