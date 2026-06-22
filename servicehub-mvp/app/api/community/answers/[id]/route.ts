/**
 * /api/community/answers/[id]
 *   PATCH  — edit body_markdown / image_urls (author only)
 *   DELETE — soft-delete (author or admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';

export const dynamic = 'force-dynamic';

interface PatchBody {
  body_markdown?: string;
  image_urls?: string[];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  if (!viewer) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });

  const { data: answer } = await client
    .from('community_answers')
    .select('author_id, post_id, is_deleted')
    .eq('id', params.id)
    .maybeSingle();
  if (!answer || answer.is_deleted) {
    return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
  }
  if (answer.author_id !== viewer.user_id && !viewer.is_admin) {
    return NextResponse.json({ error: 'Not your answer' }, { status: 403 });
  }

  let body: PatchBody = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const update: Record<string, unknown> = {};
  if (typeof body.body_markdown === 'string') {
    const m = body.body_markdown.trim();
    if (m.length < 10 || m.length > 30000) {
      return NextResponse.json({ error: 'Body must be 10-30,000 characters' }, { status: 400 });
    }
    update.body_markdown = m;
  }
  if (Array.isArray(body.image_urls)) {
    update.image_urls = body.image_urls
      .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
      .slice(0, 6);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }
  const { error } = await client.from('community_answers').update(update).eq('id', params.id);
  if (error) {
    console.error('[community] PATCH /answers/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to update answer' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
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

  const { data: answer } = await client
    .from('community_answers')
    .select('author_id, is_deleted')
    .eq('id', params.id)
    .maybeSingle();
  if (!answer || answer.is_deleted) {
    return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
  }
  if (answer.author_id !== viewer.user_id && !viewer.is_admin) {
    return NextResponse.json({ error: 'Not your answer' }, { status: 403 });
  }
  const { error } = await client
    .from('community_answers')
    .update({
      is_deleted: true,
      deleted_by: viewer.user_id,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', params.id);
  if (error) {
    console.error('[community] DELETE /answers/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to delete answer' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
