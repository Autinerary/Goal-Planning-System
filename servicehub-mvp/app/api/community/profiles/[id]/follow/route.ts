/**
 * /api/community/profiles/[id]/follow
 *   POST   — follow this user (no-op if already following)
 *   DELETE — unfollow this user
 *
 * Only public profiles can be followed. Self-follow is rejected.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  if (!viewer) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });
  if (viewer.user_id === params.id) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
  }

  const { data: target } = await client
    .from('community_profiles')
    .select('user_id, is_public')
    .eq('user_id', params.id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (!target.is_public) {
    return NextResponse.json({ error: 'Profile is private' }, { status: 403 });
  }

  const { error } = await client
    .from('community_follows')
    .upsert(
      { follower_id: viewer.user_id, followee_id: params.id },
      { onConflict: 'follower_id,followee_id', ignoreDuplicates: true }
    );
  if (error) {
    console.error('[community] follow failed:', error.message);
    return NextResponse.json({ error: 'Follow failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, following: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  if (!viewer) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });

  const { error } = await client
    .from('community_follows')
    .delete()
    .eq('follower_id', viewer.user_id)
    .eq('followee_id', params.id);
  if (error) {
    console.error('[community] unfollow failed:', error.message);
    return NextResponse.json({ error: 'Unfollow failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, following: false });
}
