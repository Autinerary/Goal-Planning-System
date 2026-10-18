import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { FEEDBACK_REASONS } from '@/lib/billing'

export const dynamic = 'force-dynamic'

/** POST /api/me/subscription-feedback { moment: 'trial_end' | 'cancel', reason, details }: why someone didn't continue (STEP 81). */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const moment = body?.moment === 'cancel' ? 'cancel' : 'trial_end'
  const reason = FEEDBACK_REASONS.some((r) => r.id === body?.reason) ? body.reason : null
  const details = typeof body?.details === 'string' ? body.details.trim().slice(0, 2000) || null : null
  if (!reason && !details) return NextResponse.json({ error: 'Choose a reason, or write one.' }, { status: 400 })
  const { error } = await supabase.from('subscription_feedback').insert({ user_id: user.id, moment, reason, details })
  if (error) return NextResponse.json({ error: 'Could not send that.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
