import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCheckinToken } from '@/lib/checkinToken'
import { STOP_REASONS, USEFULNESS, type CheckinKind } from '@/lib/checkin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/checkin
 *
 * Records a check-in answer (STEP 46, public.checkin_responses).
 *
 * Body: { kind, reason?, usefulness?, comment?, version?, token? }
 *   kind 'inactive_email'  answered from the emailed link: the signed token
 *                          identifies the person, no sign-in needed
 *   kind 'welcome_back' | 'usefulness'
 *                          answered in the app with the person's own session
 *
 * Every field is validated against the lists in lib/checkin.ts.
 *
 * Body { action: 'stop', token } turns the check-in email off from the
 * emailed link, without signing in.
 */

const REASONS = new Set<string>(STOP_REASONS.map((r) => r.id))
const USEFUL = new Set<string>(USEFULNESS.map((u) => u.id))
const KINDS = new Set<CheckinKind>(['inactive_email', 'welcome_back', 'usefulness'])

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body?.action === 'stop') return stopEmails(body?.token)

  const kind = KINDS.has(body?.kind) ? (body.kind as CheckinKind) : null
  if (!kind) return NextResponse.json({ error: 'Unknown check-in' }, { status: 400 })

  const reason = kind !== 'usefulness' && REASONS.has(body?.reason) ? body.reason : null
  const usefulness = kind === 'usefulness' && USEFUL.has(body?.usefulness) ? body.usefulness : null
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 1000) || null : null
  const version = typeof body?.version === 'string' && /^[a-z0-9._-]{1,40}$/i.test(body.version) ? body.version : null
  if (!reason && !usefulness && !comment) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })

  const row = { kind, reason, usefulness, comment, onboarding_version: version }

  if (kind === 'inactive_email') {
    const userId = verifyCheckinToken(String(body?.token || ''))
    if (!userId) return NextResponse.json({ error: 'This link has expired or is not valid.' }, { status: 401 })
    const { error } = await createAdminClient().from('checkin_responses').insert({ ...row, user_id: userId })
    if (error) return NextResponse.json({ error: 'Could not save your answer' }, { status: 500 })
    return NextResponse.json({ saved: true })
  }

  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { error } = await supabase.from('checkin_responses').insert({ ...row, user_id: user.id })
  if (error) return NextResponse.json({ error: 'Could not save your answer' }, { status: 500 })
  return NextResponse.json({ saved: true })
}

async function stopEmails(token: unknown) {
  const userId = verifyCheckinToken(String(token || ''))
  if (!userId) return NextResponse.json({ error: 'This link has expired or is not valid.' }, { status: 401 })
  const admin = createAdminClient()
  const { data: profile, error } = await admin.from('profiles').select('preferences').eq('id', userId).maybeSingle()
  if (error || !profile) return NextResponse.json({ error: 'Could not update your settings' }, { status: 500 })
  const preferences = { ...((profile.preferences as Record<string, unknown>) || {}), checkin: { optIn: false, updatedAt: new Date().toISOString() } }
  const { error: updateError } = await admin.from('profiles').update({ preferences }).eq('id', userId)
  if (updateError) return NextResponse.json({ error: 'Could not update your settings' }, { status: 500 })
  return NextResponse.json({ stopped: true })
}
