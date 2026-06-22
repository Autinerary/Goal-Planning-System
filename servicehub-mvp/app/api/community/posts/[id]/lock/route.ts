/**
 * /api/community/posts/[id]/lock
 *   POST { lock: bool, reason?: string } — admin lock/unlock a post.
 *
 * Locked posts become read-only: no new answers, no votes accepted. The
 * lock is honored by the answer-creation + vote endpoints (they check
 * the flag before writing).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';

export const dynamic = 'force-dynamic';

interface Body {
  lock?: boolean;
  reason?: string;
}

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

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const lock = body.lock !== false; // default true
  const reason = body.reason ? String(body.reason).slice(0, 500) : null;

  const update: Record<string, unknown> = lock
    ? {
        is_locked: true,
        locked_reason: reason,
        locked_by: viewer.user_id,
        locked_at: new Date().toISOString(),
      }
    : {
        is_locked: false,
        locked_reason: null,
        locked_by: null,
        locked_at: null,
      };
  const { error } = await client.from('community_posts').update(update).eq('id', params.id);
  if (error) {
    console.error('[community] lock failed:', error.message);
    return NextResponse.json({ error: 'Lock failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
