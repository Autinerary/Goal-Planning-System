import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/family/children/[id]/path
 *
 * Returns a supervised child's path payload + completed-milestone ids, but ONLY
 * if the caller is the child's verified guardian. Access is enforced here (not
 * via RLS) so we can read the child's rows with the service-role client.
 */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const childId = (ctx.params?.id || '').trim()
  if (!childId) return NextResponse.json({ error: 'Missing child id' }, { status: 400 })

  const admin = createAdminClient()

  // Verify guardianship.
  const { data: link } = await admin
    .from('guardianships')
    .select('child_id')
    .eq('guardian_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Not your dependent' }, { status: 403 })

  const [{ data: pathRow }, { data: progressRows }, { data: childRes }] = await Promise.all([
    // Same multi-row hazard as /api/me/path: pick the active path, newest first.
    admin.from('user_paths').select('payload, updated_at').eq('user_id', childId)
      .order('is_active', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1).maybeSingle(),
    admin.from('race_progress').select('milestone_id, kind').eq('user_id', childId),
    admin.auth.admin.getUserById(childId),
  ])

  const completedMilestoneIds = (progressRows || [])
    .filter((r: any) => r.kind === 'completed')
    .map((r: any) => r.milestone_id)

  const cu = childRes?.user
  return NextResponse.json({
    child: {
      id: childId,
      name: (cu?.user_metadata?.name as string) || cu?.email || 'Child',
      email: cu?.email || null,
    },
    payload: pathRow?.payload || null,
    updatedAt: pathRow?.updated_at || null,
    completedMilestoneIds,
  })
}
