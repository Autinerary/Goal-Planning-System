import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/onboarding-feedback
 *
 * The questions shown after setup (Riipen Labs: "provide surveys asking for
 * feedback and whether users were provided with the right amount of
 * information about Autinerary before creating an account"; the cohort
 * report: "Did you know what to do next?").
 *
 * Body: { nextStep?: 'yes'|'not_sure'|'no',
 *         signupClear?: 'yes'|'mostly'|'no',
 *         infoBeforeSignup?: 'too_little'|'about_right'|'too_much',
 *         setupEase?: 1-5, comment?: string, version: string }
 *
 * signupClear is "Was making your account clear and quick?" (Riipen Labs,
 * Group 25: "directly ask beta testers if signup felt clear and quick").
 * Before STEP 70 adds signup_clear, or STEP 62 next_step, the other answers
 * are kept without them.
 *
 * Written with the person's own session; RLS only allows inserting a row for
 * auth.uid(). One response per user per onboarding version: a second
 * submission is acknowledged, not stored twice.
 */

const INFO = new Set(['too_little', 'about_right', 'too_much'])
const NEXT_STEP = new Set(['yes', 'not_sure', 'no'])
const SIGNUP_CLEAR = new Set(['yes', 'mostly', 'no'])
// PGRST204 / 42703: a column that is not there yet.
const missingColumn = (error: { code?: string } | null) => Boolean(error && (error.code === 'PGRST204' || error.code === '42703'))

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const nextStep = NEXT_STEP.has(body?.nextStep) ? body.nextStep : null
  const signupClear = SIGNUP_CLEAR.has(body?.signupClear) ? body.signupClear : null
  const info = INFO.has(body?.infoBeforeSignup) ? body.infoBeforeSignup : null
  const ease = Number.isInteger(body?.setupEase) && body.setupEase >= 1 && body.setupEase <= 5 ? body.setupEase : null
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 1000) || null : null
  const version = typeof body?.version === 'string' && /^[a-z0-9._-]{1,40}$/i.test(body.version) ? body.version : null

  if (!version) return NextResponse.json({ error: 'Missing version' }, { status: 400 })
  if (!nextStep && !signupClear && !info && !ease && !comment) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })

  const row = { user_id: user.id, info_before_signup: info, setup_ease: ease, comment, onboarding_version: version }
  const withNext = nextStep ? { ...row, next_step: nextStep } : row
  let { error } = await supabase.from('onboarding_feedback').insert(signupClear ? { ...withNext, signup_clear: signupClear } : withNext)
  // signup_clear is not there yet (STEP 70 not applied): keep the rest.
  if (missingColumn(error) && signupClear) {
    if (!nextStep && !info && !ease && !comment) return NextResponse.json({ saved: false })
    ;({ error } = await supabase.from('onboarding_feedback').insert(withNext))
  }
  // next_step is not there yet either (STEP 62 not applied).
  if (missingColumn(error) && nextStep) {
    if (!info && !ease && !comment) return NextResponse.json({ saved: false })
    ;({ error } = await supabase.from('onboarding_feedback').insert(row))
  }

  // 23505: unique violation, i.e. this person already answered for this version.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Could not save your answers' }, { status: 500 })
  }
  return NextResponse.json({ saved: true })
}
