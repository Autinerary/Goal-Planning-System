/**
 * /api/community/posts/[id]/lock
 *   POST { lock: bool, reason?: string } — admin lock/unlock a post.
 *
 * Locked posts become read-only: no new answers, no votes accepted. The
 * lock is honored by the answer-creation + vote endpoints (they check
 * the flag before writing).
 *
 * Admins are the people in public.admin_users. The write runs as the
 * signed-in admin under RLS (community_posts_admin_update, STEP 58), not with
 * the service-role key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isCommunityAdmin } from '@/lib/community/client';

export const dynamic = 'force-dynamic';

interface Body {
  lock?: boolean;
  reason?: string;
}

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
        locked_by: user.id,
        locked_at: new Date().toISOString(),
      }
    : {
        is_locked: false,
        locked_reason: null,
        locked_by: null,
        locked_at: null,
      };
  const { data, error } = await supabase
    .from('community_posts')
    .update(update)
    .eq('id', params.id)
    .select('id');
  if (error) {
    console.error('[community] lock failed:', error.message);
    return NextResponse.json({ error: 'Lock failed' }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
