import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hashToken, hasSelfMark, SELF_MARK_COOKIE } from '@/lib/trust/verificationToken'

export const dynamic = 'force-dynamic'

const VERIFIER_TYPES = ['clinician', 'support_worker', 'educator'] as const

/** Load a pending, unexpired request by raw token. Null if unusable. */
async function loadRequest(token: string) {
  if (!token || token.length < 20) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('norm_verification_requests')
    .select('id, user_id, barrier_type, status, expires_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle()

  if (!data) return null
  if (data.status !== 'pending') return { ...data, unusable: data.status }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ...data, unusable: 'expired' as const }
  }
  return { ...data, unusable: null }
}

/**
 * GET /api/verification/[token] — what the verifier is being asked to confirm.
 * Public (the verifier has no account) but useless without the token.
 * Deliberately minimal: the person's name and the norm — nothing clinical.
 */
export async function GET(_req: NextRequest, ctx: { params: { token: string } }) {
  const req = await loadRequest(ctx.params.token)
  if (!req) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (req.unusable) return NextResponse.json({ error: req.unusable }, { status: 410 })

  const admin = createAdminClient()
  const { data: userRes } = await admin.auth.admin.getUserById(req.user_id)
  const name =
    (userRes?.user?.user_metadata as any)?.full_name ||
    userRes?.user?.email?.split('@')[0] ||
    'This person'

  return NextResponse.json({ name, barrierType: req.barrier_type })
}

const NOT_YOURSELF =
  "This link is for the professional who knows you to fill in, so it can't be completed from your own account or the browser that made it. Please send them the link; they don't need an account."

/**
 * POST /api/verification/[token] — the verifier attests. We record ONLY that a
 * professional confirmed it, when, and their role. No document is accepted;
 * any extra fields in the body are ignored by design.
 *
 * The person it verifies can't complete it themselves: not while signed in
 * as themselves, and not from the browser that asked for the link (bug
 * audit, 17 November 2026, item 16). The norm is marked verified as the
 * service, after these checks; since STEP 105 only the service can.
 */
export async function POST(request: NextRequest, ctx: { params: { token: string } }) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const verifierType = String(body?.verifierType || '').trim()
  if (!VERIFIER_TYPES.includes(verifierType as any)) {
    return NextResponse.json({ error: 'Select your role.' }, { status: 400 })
  }
  if (body?.attested !== true) {
    return NextResponse.json({ error: 'You must confirm the statement.' }, { status: 400 })
  }

  const req = await loadRequest(ctx.params.token)
  if (!req) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (req.unusable) return NextResponse.json({ error: req.unusable }, { status: 410 })

  // Not by the person it verifies.
  if (hasSelfMark(request.cookies.get(SELF_MARK_COOKIE)?.value, req.user_id)) {
    return NextResponse.json({ error: NOT_YOURSELF }, { status: 403 })
  }
  try {
    const {
      data: { user: signedIn },
    } = await createClient().auth.getUser()
    if (signedIn?.id === req.user_id) {
      return NextResponse.json({ error: NOT_YOURSELF }, { status: 403 })
    }
  } catch {
    // No session to compare: the professional usually has no account.
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Single-use: only flip a row that is still pending, so a replayed request
  // can't complete twice.
  const { data: claimed, error: claimErr } = await admin
    .from('norm_verification_requests')
    .update({ status: 'completed', verifier_type: verifierType, completed_at: now })
    .eq('id', req.id)
    .eq('status', 'pending')
    .select('id')
  if (claimErr || !claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'already_used' }, { status: 410 })
  }

  const { data: marked, error: markErr } = await admin
    .from('user_barriers')
    .update({
      verification_method: 'professional',
      verified_at: now,
      verifier_type: verifierType,
    })
    .eq('user_id', req.user_id)
    .eq('barrier_type', req.barrier_type)
    .select('id')

  if (markErr || !marked || marked.length === 0) {
    console.error('[verification] marking norm failed:', markErr?.message || 'the norm is no longer on their profile')
    // Let the link be used again once the norm can be marked.
    await admin.from('norm_verification_requests').update({ status: 'pending', verifier_type: null, completed_at: null }).eq('id', req.id)
    return NextResponse.json({ error: 'Could not record the verification.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
