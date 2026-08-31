import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/peers/vouch — a member with lived experience of a norm vouches
 * that another member shares it.
 *
 * verification_method='peer' had a UI badge but nothing ever wrote it. This
 * makes it real, and mirrors the organisation-vouch rules: we record only WHO
 * vouched, for WHOM, on WHICH norm. No diagnosis, no document, no free text.
 *
 * Two vouches are required before the badge flips. One person's say-so is not
 * verification, and the pair could simply be two accounts run by one person.
 *
 * Guards:
 *   - caller signed in, and not vouching for themselves
 *   - the caller must have the SAME norm on their own profile
 *   - with LIVED experience of it — an ally cannot confer peer status, which
 *     is the entire point of the proximity weighting
 *   - the caller must have standing (already verified, or a real rating
 *     record). Otherwise two fresh accounts vouch for each other and both
 *     walk away verified.
 *   - the norm must already be self-declared by the target — a voucher
 *     confirms what someone said about themselves, never adds a norm for them
 *   - never downgrades an organisation or professional verification
 */

/** Vouches needed before verification_method flips to 'peer'. */
const PEER_THRESHOLD = 2

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const voucheeId = String(body?.userId || '').trim()
  const barrierType = String(body?.barrierType || '').trim().toLowerCase()
  const revoke = body?.revoke === true
  if (!voucheeId || !barrierType) {
    return NextResponse.json({ error: 'Missing userId or barrierType.' }, { status: 400 })
  }
  if (voucheeId === user.id) {
    return NextResponse.json({ error: 'You cannot vouch for yourself.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // The voucher must share the norm, with lived experience of it.
  const { data: mine } = await admin
    .from('user_barriers')
    .select('relationship, verification_method')
    .eq('user_id', user.id)
    .eq('barrier_type', barrierType)
    .maybeSingle()
  if (!mine) {
    return NextResponse.json(
      { error: 'You can only vouch for a norm that is on your own profile.' },
      { status: 403 }
    )
  }
  if ((mine.relationship || 'lived') !== 'lived') {
    return NextResponse.json(
      { error: 'Only people with lived experience of this norm can vouch for it.' },
      { status: 403 }
    )
  }

  // Standing check — the Sybil guard. Either already verified by someone
  // outside this mechanism, or a genuine rating record.
  const alreadyVerified = ['peer', 'organization', 'professional'].includes(
    String(mine.verification_method || 'self')
  )
  if (!alreadyVerified) {
    const { data: trust } = await admin.rpc('rater_trust', { p_user_id: user.id }).maybeSingle()
    const tier = String((trust as any)?.tier || 'new')
    if (tier === 'new') {
      return NextResponse.json(
        {
          error:
            'You need a bit more history on your account before you can vouch for someone. Rate a few resources first.',
        },
        { status: 403 }
      )
    }
  }

  // The target must already have declared this norm themselves.
  const { data: theirs } = await admin
    .from('user_barriers')
    .select('id, verification_method')
    .eq('user_id', voucheeId)
    .eq('barrier_type', barrierType)
    .maybeSingle()
  if (!theirs) {
    return NextResponse.json({ error: 'That norm is not on their profile.' }, { status: 400 })
  }
  if (['organization', 'professional'].includes(String(theirs.verification_method))) {
    return NextResponse.json(
      { error: 'This norm already carries a stronger verification.' },
      { status: 409 }
    )
  }

  // Record or withdraw this one vouch.
  if (revoke) {
    const { error } = await admin
      .from('peer_vouches')
      .delete()
      .eq('voucher_id', user.id)
      .eq('vouchee_id', voucheeId)
      .eq('barrier_type', barrierType)
    if (error) {
      console.error('[peer] revoke failed:', error.message)
      return NextResponse.json({ error: 'Could not withdraw the vouch.' }, { status: 500 })
    }
  } else {
    const { error } = await admin.from('peer_vouches').upsert(
      { voucher_id: user.id, vouchee_id: voucheeId, barrier_type: barrierType },
      { onConflict: 'voucher_id,vouchee_id,barrier_type' }
    )
    if (error) {
      console.error('[peer] vouch failed:', error.message)
      return NextResponse.json({ error: 'Could not record the vouch.' }, { status: 500 })
    }
  }

  // Recount and set the badge to match. Counting distinct rows rather than
  // incrementing keeps this correct even if a vouch is withdrawn.
  const { count } = await admin
    .from('peer_vouches')
    .select('id', { count: 'exact', head: true })
    .eq('vouchee_id', voucheeId)
    .eq('barrier_type', barrierType)

  const vouches = count ?? 0
  const method = vouches >= PEER_THRESHOLD ? 'peer' : 'self'
  const { error: updErr } = await admin
    .from('user_barriers')
    .update({
      verification_method: method,
      verified_at: method === 'peer' ? new Date().toISOString() : null,
    })
    .eq('id', theirs.id)
  if (updErr) {
    console.error('[peer] badge update failed:', updErr.message)
    return NextResponse.json({ error: 'Vouch saved, but the badge did not update.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    vouches,
    needed: PEER_THRESHOLD,
    method,
  })
}

/** GET /api/peers/vouch?userId=&barrierType= — count, and whether you vouched. */
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const voucheeId = String(searchParams.get('userId') || '').trim()
  const barrierType = String(searchParams.get('barrierType') || '').trim().toLowerCase()
  if (!voucheeId || !barrierType) {
    return NextResponse.json({ error: 'Missing userId or barrierType.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { count } = await admin
    .from('peer_vouches')
    .select('id', { count: 'exact', head: true })
    .eq('vouchee_id', voucheeId)
    .eq('barrier_type', barrierType)

  const { data: own } = await admin
    .from('peer_vouches')
    .select('id')
    .eq('voucher_id', user.id)
    .eq('vouchee_id', voucheeId)
    .eq('barrier_type', barrierType)
    .maybeSingle()

  return NextResponse.json({
    vouches: count ?? 0,
    needed: PEER_THRESHOLD,
    youVouched: Boolean(own),
  })
}
