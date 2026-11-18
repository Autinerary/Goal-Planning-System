/**
 * /api/community/posts/[id]/vote
 *   POST { value: -1 | 0 | 1 } — cast / change / retract vote on this post.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  CANT_POST_MESSAGE,
  getCommunityServiceClient,
  getCommunityViewer,
  isPostingBlockedError,
} from '@/lib/community/client';
import { LOCKED_MESSAGE, loadPostState } from '@/lib/community/locks';

export const dynamic = 'force-dynamic';

interface Body {
  value?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer({ forWriting: true });
  if (!viewer) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });
  if (viewer.blocked) return NextResponse.json({ error: viewer.blocked, code: 'blocked' }, { status: 403 });

  // Only a post people can see takes votes, and a locked one takes none.
  const post = await loadPostState(client, params.id);
  if (!post || post.is_deleted || post.status !== 'published') {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }
  if (post.is_locked) {
    return NextResponse.json({ error: LOCKED_MESSAGE, code: 'locked' }, { status: 403 });
  }

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const value = body.value;
  if (value !== -1 && value !== 0 && value !== 1) {
    return NextResponse.json({ error: 'Value must be -1, 0, or 1' }, { status: 400 });
  }

  const { error } = await client.rpc('community_cast_vote', {
    p_voter_id: viewer.user_id,
    p_target_type: 'post',
    p_target_id: params.id,
    p_value: value,
  });
  if (error) {
    if (isPostingBlockedError(error)) {
      return NextResponse.json({ error: CANT_POST_MESSAGE, code: 'blocked' }, { status: 403 });
    }
    console.error('[community] vote post failed:', error.message);
    return NextResponse.json({ error: 'Vote failed' }, { status: 500 });
  }

  // Re-read score for client-side optimistic-reconciliation.
  const { data: counts } = await client
    .from('community_posts')
    .select('upvotes, downvotes, score')
    .eq('id', params.id)
    .maybeSingle();
  return NextResponse.json({ ok: true, ...(counts ?? {}), viewer_vote: value });
}
