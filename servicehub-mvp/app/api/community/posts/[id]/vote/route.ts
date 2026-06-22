/**
 * /api/community/posts/[id]/vote
 *   POST { value: -1 | 0 | 1 } — cast / change / retract vote on this post.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';

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
  const viewer = await getCommunityViewer();
  if (!viewer) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });

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
    console.error('[community] vote post failed:', error.message);
    return NextResponse.json({ error: 'Vote failed' }, { status: 500 });
  }

  // Re-read score for client-side optimistic-reconciliation.
  const { data: post } = await client
    .from('community_posts')
    .select('upvotes, downvotes, score')
    .eq('id', params.id)
    .maybeSingle();
  return NextResponse.json({ ok: true, ...(post ?? {}), viewer_vote: value });
}
