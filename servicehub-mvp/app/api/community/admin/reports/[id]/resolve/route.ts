/**
 * /api/community/admin/reports/[id]/resolve
 *   POST { status, note?, remove_target?, lock_post? } — admin resolution.
 *
 * Admin-only (public.admin_users). community_resolve_report (STEP 58) does
 * the whole resolution, removing or locking the target as asked, in one
 * transaction, as the signed-in admin, not with the service-role key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isCommunityAdmin } from '@/lib/community/client';
import type { ResolveReportPayload } from '@/types/community';

export const dynamic = 'force-dynamic';

const VALID_STATUS: ReadonlyArray<ResolveReportPayload['status']> = [
  'resolved_kept',
  'resolved_removed',
  'resolved_warned',
];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });
  if (!(await isCommunityAdmin(supabase))) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  let body: ResolveReportPayload | undefined;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { error } = await supabase.rpc('community_resolve_report', {
    p_report_id: params.id,
    p_status: body.status,
    p_note: body.note ?? null,
    p_remove_target: !!body.remove_target,
    p_lock_post: !!body.lock_post,
  });
  if (error) {
    if (error.code === 'P0002' || error.code === '22P02') {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    if (error.code === '55000') {
      return NextResponse.json({ error: 'Report already resolved' }, { status: 400 });
    }
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }
    console.error('[community] resolve report failed:', error.message);
    return NextResponse.json({ error: 'Resolve failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
