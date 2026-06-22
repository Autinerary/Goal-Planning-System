/**
 * /api/community/posts/[id]/answers
 *   POST { body_markdown, parent_id?, image_urls? } — add an answer or
 *   threaded reply to an existing answer.
 *
 * Threaded: pass `parent_id` to reply to another answer instead of the
 * post itself.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';
import { generatePseudonym } from '@/lib/community/pseudonym';

export const dynamic = 'force-dynamic';

interface Body {
  body_markdown?: string;
  parent_id?: string | null;
  image_urls?: string[];
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

  const postId = params.id;
  const { data: post } = await client
    .from('community_posts')
    .select('id, is_locked, is_deleted')
    .eq('id', postId)
    .maybeSingle();
  if (!post || post.is_deleted) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }
  if (post.is_locked) {
    return NextResponse.json({ error: 'Post is locked' }, { status: 403 });
  }

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const markdown = (body.body_markdown ?? '').trim();
  if (markdown.length < 10 || markdown.length > 30000) {
    return NextResponse.json({ error: 'Body must be 10-30,000 characters' }, { status: 400 });
  }
  const parentId = body.parent_id || null;
  if (parentId) {
    const { data: parent } = await client
      .from('community_answers')
      .select('id, post_id, is_deleted')
      .eq('id', parentId)
      .maybeSingle();
    if (!parent || parent.is_deleted || parent.post_id !== postId) {
      return NextResponse.json({ error: 'Parent answer not found in this post' }, { status: 400 });
    }
  }
  const imageUrls = (body.image_urls ?? [])
    .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
    .slice(0, 6);

  // Lazily create the community profile (mirrors POST /posts).
  const { data: existing } = await client
    .from('community_profiles')
    .select('user_id')
    .eq('user_id', viewer.user_id)
    .maybeSingle();
  if (!existing) {
    for (let i = 0; i < 5; i++) {
      const candidate = generatePseudonym();
      const { error } = await client
        .from('community_profiles')
        .insert({ user_id: viewer.user_id, pseudonym: candidate });
      if (!error) break;
      if (!error.message?.includes('duplicate')) break;
    }
  }

  const { data: answer, error } = await client
    .from('community_answers')
    .insert({
      post_id: postId,
      parent_id: parentId,
      author_id: viewer.user_id,
      body_markdown: markdown,
      image_urls: imageUrls,
    })
    .select('id')
    .single();
  if (error || !answer) {
    console.error('[community] POST /answers failed:', error?.message);
    return NextResponse.json({ error: 'Failed to create answer' }, { status: 500 });
  }
  return NextResponse.json({ id: answer.id }, { status: 201 });
}
