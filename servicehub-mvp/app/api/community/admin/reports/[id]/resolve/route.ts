/**
 * /api/community/admin/reports/[id]/resolve
 *   POST { status, note?, remove_target?, lock_post? } — admin resolution.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';
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
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  if (!viewer || !viewer.is_admin) {
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

  const { data: report } = await client
    .from('community_reports')
    .select('id, target_type, target_id, status')
    .eq('id', params.id)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  if (report.status !== 'open') {
    return NextResponse.json({ error: 'Report already resolved' }, { status: 400 });
  }

  // Apply side effects requested by the moderator.
  const sideEffects: Array<Promise<unknown>> = [];
  if (body.remove_target) {
    if (report.target_type === 'post') {
      sideEffects.push(
        client
          .from('community_posts')
          .update({
            is_deleted: true,
            deleted_by: viewer.user_id,
            deleted_at: new Date().toISOString(),
          })
          .eq('id', report.target_id)
      );
    } else if (report.target_type === 'answer') {
      sideEffects.push(
        client
          .from('community_answers')
          .update({
            is_deleted: true,
            deleted_by: viewer.user_id,
            deleted_at: new Date().toISOString(),
          })
          .eq('id', report.target_id)
      );
    }
  }
  if (body.lock_post && report.target_type === 'post') {
    sideEffects.push(
      client
        .from('community_posts')
        .update({
          is_locked: true,
          locked_reason: body.note?.slice(0, 500) ?? null,
          locked_by: viewer.user_id,
          locked_at: new Date().toISOString(),
        })
        .eq('id', report.target_id)
    );
  }

  const results = await Promise.all(sideEffects);
  for (const r of results) {
    const errOk = r as { error?: { message?: string } | null };
    if (errOk?.error) {
      console.warn('[community] admin side effect failed:', errOk.error.message);
    }
  }

  const { error } = await client
    .from('community_reports')
    .update({
      status: body.status,
      resolved_by: viewer.user_id,
      resolved_at: new Date().toISOString(),
      resolution_note: body.note?.slice(0, 1000) ?? null,
    })
    .eq('id', params.id);
  if (error) {
    console.error('[community] resolve report failed:', error.message);
    return NextResponse.json({ error: 'Resolve failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
