import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { voteSignatureMatches } from '@/lib/choiceLinks'
import { torontoMonth, votingOpen } from '@/lib/choiceTime'
import { CHOICE_KINDS, type ChoiceKind } from '@/lib/communityChoice'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/community-choice/vote  { month, picks: { service?, product?, article? }, v?, t? }
 *
 * A vote for the month's Community's Choice (Goal 5), from the newsletter's
 * link (v and t: who, signed; lib/choiceLinks.ts) or signed in. One vote per
 * kind per month, for something on the month's ballot; voting again changes
 * it. Only in the month's last week (lib/choiceTime.ts). Written with the
 * server key: votes are not readable or writable directly (STEP 79).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const month = String(body?.month || '')
  const now = new Date()
  if (month !== torontoMonth(now) || !votingOpen(month, now)) {
    return NextResponse.json({ error: 'Voting for this month is not open.' }, { status: 409 })
  }

  let voter = ''
  if (body?.v && voteSignatureMatches(body.v, month, body.t)) {
    voter = String(body.v).toLowerCase()
  } else {
    const supabase = createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) voter = `u:${user.id}`
  }
  if (!voter) return NextResponse.json({ error: 'Open the vote from your newsletter link, or sign in.' }, { status: 401 })

  const picks = (body?.picks || {}) as Partial<Record<ChoiceKind, string>>
  const chosen = CHOICE_KINDS.filter((k) => typeof picks[k.id] === 'string' && UUID.test(picks[k.id] as string))
  if (chosen.length === 0) return NextResponse.json({ error: 'Choose at least one.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: ballot } = await admin.from('choice_ballots').select('kind, item_id').eq('month', month)
  const onBallot = new Set((ballot || []).map((b) => `${b.kind}:${b.item_id}`))
  const rows = chosen
    .filter((k) => onBallot.has(`${k.id}:${picks[k.id]}`))
    .map((k) => ({ month, kind: k.id, voter, item_id: picks[k.id] as string, updated_at: now.toISOString() }))
  if (rows.length === 0) return NextResponse.json({ error: 'Those are not on this month’s ballot.' }, { status: 400 })
  const { error } = await admin.from('choice_votes').upsert(rows, { onConflict: 'month,kind,voter' })
  if (error) {
    console.error('vote failed:', error.message)
    return NextResponse.json({ error: 'Could not save your vote. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, saved: rows.map((r) => r.kind) })
}
