/**
 * /api/community/reports
 *   POST { target_type, target_id, reason } — file a moderation report.
 *
 * Anyone signed in can report. Each user may report a given target once.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';
import type { ReportTarget } from '@/types/community';

export const dynamic = 'force-dynamic';

interface Body {
  target_type?: ReportTarget;
  target_id?: string;
  reason?: string;
}

const VALID: ReadonlyArray<ReportTarget> = ['post', 'answer', 'user'];

export async function POST(request: NextRequest) {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  if (!viewer) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const targetType = body.target_type;
  const targetId = body.target_id;
  const reason = (body.reason ?? '').trim();
  if (!targetType || !VALID.includes(targetType)) {
    return NextResponse.json({ error: 'Invalid target_type' }, { status: 400 });
  }
  if (!targetId) return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
  if (reason.length < 5 || reason.length > 1000) {
    return NextResponse.json({ error: 'Reason must be 5-1000 characters' }, { status: 400 });
  }

  const { error } = await client
    .from('community_reports')
    .upsert(
      {
        reporter_id: viewer.user_id,
        target_type: targetType,
        target_id: targetId,
        reason,
      },
      { onConflict: 'reporter_id,target_type,target_id', ignoreDuplicates: false }
    );
  if (error) {
    console.error('[community] report failed:', error.message);
    return NextResponse.json({ error: 'Report failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
