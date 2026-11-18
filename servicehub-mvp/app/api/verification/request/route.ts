import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addSelfMark, generateToken, hashToken, SELF_MARK_COOKIE, VERIFICATION_TTL_DAYS } from '@/lib/trust/verificationToken'

export const dynamic = 'force-dynamic'

/**
 * POST /api/verification/request — start a professional attestation for one of
 * the caller's own norms. Returns a one-time link to hand to their clinician.
 *
 * The raw token is returned exactly once and never stored; only its hash is.
 * No document is requested or accepted anywhere in this flow.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const barrierType = String(body?.barrierType || '').trim().toLowerCase()
  if (!barrierType) {
    return NextResponse.json({ error: 'Pick which norm to verify.' }, { status: 400 })
  }

  // Only allow verifying a norm the caller actually has.
  const { data: owned } = await supabase
    .from('user_barriers')
    .select('barrier_type')
    .eq('user_id', user.id)
    .eq('barrier_type', barrierType)
    .limit(1)
  if (!owned || owned.length === 0) {
    return NextResponse.json({ error: 'That norm is not on your profile.' }, { status: 400 })
  }

  const token = generateToken()
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_DAYS * 86_400_000).toISOString()

  const admin = createAdminClient()

  // Supersede any earlier pending request for the same norm so only one link
  // is ever live at a time.
  await admin
    .from('norm_verification_requests')
    .update({ status: 'revoked' })
    .eq('user_id', user.id)
    .eq('barrier_type', barrierType)
    .eq('status', 'pending')

  const { error } = await admin.from('norm_verification_requests').insert({
    user_id: user.id,
    barrier_type: barrierType,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  })
  if (error) {
    console.error('[verification] create failed:', error.message)
    return NextResponse.json({ error: 'Could not create the link.' }, { status: 500 })
  }

  const origin = request.nextUrl.origin
  const response = NextResponse.json({
    url: `${origin}/verify/${token}`,
    expiresAt,
    expiresInDays: VERIFICATION_TTL_DAYS,
  })
  // This browser asked for the link, so it can't fill it in (app/api/verification/[token]).
  response.cookies.set({
    name: SELF_MARK_COOKIE,
    value: addSelfMark(request.cookies.get(SELF_MARK_COOKIE)?.value, user.id),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/verification',
    maxAge: VERIFICATION_TTL_DAYS * 86_400,
  })
  return response
}
