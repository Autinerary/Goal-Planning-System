import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/organizations/members?orgId=… — members plus each one's norms and
 * how they're verified. Leaders only: this is the vouching workspace.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  const orgId = request.nextUrl.searchParams.get('orgId') || ''
  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  const admin = createAdminClient()
  const { data: me } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!me || me.role !== 'leader') {
    return NextResponse.json({ error: 'Leaders only.' }, { status: 403 })
  }

  const { data: rows } = await admin
    .from('organization_members')
    .select('user_id, role, joined_at')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: true })

  const members = await Promise.all(
    (rows || []).map(async (m: any) => {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id)
      const { data: norms } = await admin
        .from('user_barriers')
        .select('barrier_type, verification_method, verified_by_org_id')
        .eq('user_id', m.user_id)
      return {
        userId: m.user_id,
        role: m.role,
        name:
          (u?.user?.user_metadata as any)?.full_name ||
          u?.user?.email?.split('@')[0] ||
          'Member',
        norms: (norms || []).map((n: any) => ({
          type: n.barrier_type,
          method: n.verification_method || 'self',
          vouchedByThisOrg: n.verified_by_org_id === orgId,
        })),
      }
    })
  )

  return NextResponse.json({ members })
}
