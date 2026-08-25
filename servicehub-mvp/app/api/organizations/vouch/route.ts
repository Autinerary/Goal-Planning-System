import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/organizations/vouch — an org leader vouches that a member
 * identifies with a norm.
 *
 * Records only: verification_method='organization', verified_at, and WHICH org.
 * No diagnosis, no document, no clinical detail — there is no field for one.
 *
 * Guards:
 *   - caller must be a 'leader' of the org
 *   - the org must be admin-verified (an unverified org can't mint trust)
 *   - the target must be a member of that same org
 *   - the norm must already be on the member's profile (a leader confirms
 *     what the person said about themselves; they can't add norms for them)
 *   - never downgrades a professional verification
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const orgId = String(body?.orgId || '').trim()
  const memberId = String(body?.userId || '').trim()
  const barrierType = String(body?.barrierType || '').trim().toLowerCase()
  const revoke = body?.revoke === true
  if (!orgId || !memberId || !barrierType) {
    return NextResponse.json({ error: 'Missing orgId, userId or barrierType.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Caller must lead this org.
  const { data: leader } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!leader || leader.role !== 'leader') {
    return NextResponse.json({ error: 'Leaders only.' }, { status: 403 })
  }

  // Only admin-verified orgs confer a badge.
  const { data: org } = await admin
    .from('organizations')
    .select('id, is_verified')
    .eq('id', orgId)
    .maybeSingle()
  if (!org) return NextResponse.json({ error: 'Organisation not found.' }, { status: 404 })
  if (!org.is_verified) {
    return NextResponse.json(
      { error: 'This organisation is not verified yet, so it cannot vouch.' },
      { status: 403 }
    )
  }

  // Target must belong to the same org.
  const { data: member } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('user_id', memberId)
    .maybeSingle()
  if (!member) {
    return NextResponse.json({ error: 'That person is not in this organisation.' }, { status: 400 })
  }

  // The norm must already be self-declared by the member.
  const { data: norm } = await admin
    .from('user_barriers')
    .select('id, verification_method')
    .eq('user_id', memberId)
    .eq('barrier_type', barrierType)
    .maybeSingle()
  if (!norm) {
    return NextResponse.json({ error: 'That norm is not on their profile.' }, { status: 400 })
  }
  if (norm.verification_method === 'professional') {
    return NextResponse.json(
      { error: 'This norm already has a professional verification.' },
      { status: 409 }
    )
  }

  const update = revoke
    ? { verification_method: 'self', verified_at: null, verified_by_org_id: null }
    : {
        verification_method: 'organization',
        verified_at: new Date().toISOString(),
        verified_by_org_id: orgId,
      }

  const { error } = await admin.from('user_barriers').update(update).eq('id', norm.id)
  if (error) {
    console.error('[org] vouch failed:', error.message)
    return NextResponse.json({ error: 'Could not record the vouch.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, method: update.verification_method })
}
