import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAge } from '@/lib/age'
import { FAMILY_NEEDS_PLAN, familyAllowed } from '@/lib/trustedAdult'
import { emailEnabled, sendEmail, teenApprovedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/family/requests/<id> { action: 'approve' | 'decline', relationship,
 * legalGuardianConsent, reviewed }: the adult a teen asked decides (STEP 84).
 * Approving needs what adding a child needs (app/api/family/children): an
 * adult account with a date of birth, being their parent or legal guardian,
 * and having reviewed their details; once paid plans are on, a plan or free
 * access too. It links them (guardianships) and unlocks the account.
 * Declining leaves it locked; nothing is deleted.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Which request?' }, { status: 400 })
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const action = body?.action === 'approve' ? 'approve' : body?.action === 'decline' ? 'decline' : null
  if (!action) return NextResponse.json({ error: 'Approve or decline?' }, { status: 400 })

  // The request, as the adult can see it (guardian_requests_read_own).
  const { data: request } = await supabase.from('guardian_requests').select('id, child_id, adult_id, status').eq('id', params.id).eq('adult_id', user.id).maybeSingle()
  if (!request || request.status !== 'pending') return NextResponse.json({ error: 'That request isn’t waiting for you.' }, { status: 404 })
  const admin = createAdminClient()
  const now = new Date().toISOString()

  if (action === 'decline') {
    await admin.from('guardian_requests').update({ status: 'declined', decided_at: now }).eq('id', request.id).eq('status', 'pending')
    return NextResponse.json({ declined: true })
  }

  const adultAge = computeAge(user.app_metadata?.date_of_birth || user.user_metadata?.date_of_birth)
  if (adultAge === null || adultAge < 18 || user.app_metadata?.managed_by_guardian || user.user_metadata?.managed_by_guardian) {
    return NextResponse.json({ error: 'An adult account with a recorded date of birth is required.' }, { status: 403 })
  }
  const relationship = body?.relationship === 'legal_guardian' ? 'legal_guardian' : body?.relationship === 'parent' ? 'parent' : null
  if (!relationship || body?.legalGuardianConsent !== true || body?.reviewed !== true) {
    return NextResponse.json({ error: 'Review their details and confirm that you are their parent or legal guardian.' }, { status: 400 })
  }
  if (!(await familyAllowed(supabase))) return NextResponse.json({ error: FAMILY_NEEDS_PLAN, code: 'plan' }, { status: 402 })

  const { data: child } = await admin.auth.admin.getUserById(request.child_id)
  const dob = child?.user?.app_metadata?.date_of_birth || child?.user?.user_metadata?.date_of_birth
  const childAge = computeAge(dob)
  if (!child?.user || childAge === null || childAge >= 18) return NextResponse.json({ error: 'That account isn’t one for someone under 18.' }, { status: 409 })

  const { error: linkError } = await admin.from('guardianships').upsert({ guardian_id: user.id, child_id: request.child_id, relationship }, { onConflict: 'guardian_id,child_id' })
  if (linkError) return NextResponse.json({ error: 'Could not link the accounts. Please try again.' }, { status: 500 })
  const { error: approvalError } = await admin.auth.admin.updateUserById(request.child_id, {
    ban_duration: 'none',
    app_metadata: {
      managed_by_guardian: true,
      guardian_id: user.id,
      date_of_birth: dob,
      guardian_approval: { state: 'approved', relationship, requested_by: 'child', attestation_version: '2026-10-19', approved_at: now, approved_by: user.id },
    },
  })
  if (approvalError) return NextResponse.json({ error: 'Linked, but the account could not be unlocked. Please try again.' }, { status: 503 })
  await admin.from('guardian_requests').update({ status: 'approved', relationship, decided_at: now }).eq('id', request.id)
  await admin.from('profiles').upsert({ id: user.id, email: user.email, plan: 'family' }, { onConflict: 'id' }).then(() => {}, () => {})
  if (emailEnabled() && child.user.email) {
    const origin = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
    const { subject, html, text } = teenApprovedEmail(`${origin}/login`)
    await sendEmail({ to: child.user.email, subject, html, text, idempotencyKey: `guardian-approved-${request.child_id}` }).catch(() => null)
  }
  return NextResponse.json({ approved: true })
}
