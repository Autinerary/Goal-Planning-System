import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/onboarding-feedback
 *
 * The two-question survey shown after setup (Riipen Labs: "provide surveys
 * asking for feedback and whether users were provided with the right amount
 * of information about Autinerary before creating an account").
 *
 * Body: { infoBeforeSignup?: 'too_little'|'about_right'|'too_much',
 *         setupEase?: 1-5, comment?: string, version: string }
 *
 * Written with the person's own session; RLS only allows inserting a row for
 * auth.uid(). One response per user per onboarding version: a second
 * submission is acknowledged, not stored twice.
 */

const INFO = new Set(['too_little', 'about_right', 'too_much'])

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

  const info = INFO.has(body?.infoBeforeSignup) ? body.infoBeforeSignup : null
  const ease = Number.isInteger(body?.setupEase) && body.setupEase >= 1 && body.setupEase <= 5 ? body.setupEase : null
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 1000) || null : null
  const version = typeof body?.version === 'string' && /^[a-z0-9._-]{1,40}$/i.test(body.version) ? body.version : null

  if (!version) return NextResponse.json({ error: 'Missing version' }, { status: 400 })
  if (!info && !ease && !comment) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })

  const { error } = await supabase.from('onboarding_feedback').insert({
    user_id: user.id,
    info_before_signup: info,
    setup_ease: ease,
    comment,
    onboarding_version: version,
  })

  // 23505: unique violation, i.e. this person already answered for this version.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Could not save your answers' }, { status: 500 })
  }
  return NextResponse.json({ saved: true })
}
