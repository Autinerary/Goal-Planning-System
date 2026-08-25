import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** GET /api/organizations/mine — orgs the caller belongs to, with their role. */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ organizations: [] })

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
  if (!rows || rows.length === 0) return NextResponse.json({ organizations: [] })

  // Explicit columns — never select join_code for non-leaders.
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, slug, name, description, is_verified')
    .in('id', rows.map((r: any) => r.org_id))

  const roleById = new Map(rows.map((r: any) => [r.org_id, r.role]))
  return NextResponse.json({
    organizations: (orgs || []).map((o: any) => ({ ...o, role: roleById.get(o.id) || 'member' })),
  })
}
