/**
 * /api/community/posts/[id]
 *   GET    — full post detail (with threaded answers + viewer state)
 *   PATCH  — edit title/body/tags/image_urls (author only)
 *   DELETE — soft-delete (author or admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';
import { loadAuthorMap, loadViewerVotes } from '@/lib/community/hydrate';
import { markdownExcerpt } from '@/lib/community/markdown';
import { buildAnswerTree } from '@/lib/community/threading';
import type { CommunityPostDetail } from '@/types/community';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  const postId = params.id;

  const { data: post, error } = await client
    .from('community_posts')
    .select(
      'id, author_id, title, body_markdown, barrier_tags, category_tags, image_urls, upvotes, downvotes, score, answer_count, view_count, accepted_answer_id, solved_tldr, solved_key_insight, is_locked, locked_reason, locked_by, locked_at, is_deleted, last_activity_at, created_at, updated_at'
    )
    .eq('id', postId)
    .maybeSingle();
  if (error) {
    console.error('[community] GET /posts/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 });
  }
  if (!post || post.is_deleted) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  // Best-effort view counter; ignore failures.
  try {
    await client
      .from('community_posts')
      .update({ view_count: post.view_count + 1 })
      .eq('id', postId);
  } catch (err) {
    console.warn('[community] view counter failed:', err);
  }

  // Answers + their authors + viewer votes.
  const { data: answers } = await client
    .from('community_answers')
    .select(
      'id, post_id, parent_id, author_id, body_markdown, image_urls, upvotes, downvotes, score, is_accepted, accepted_at, created_at, updated_at'
    )
    .eq('post_id', postId)
    .eq('is_deleted', false);

  const authorIds = [
    post.author_id,
    ...((answers ?? []).map((a) => a.author_id)),
  ];
  const authorMap = await loadAuthorMap(client, authorIds);
  const answerVotes = await loadViewerVotes(
    client,
    viewer?.user_id ?? null,
    'answer',
    (answers ?? []).map((a) => a.id)
  );
  const postVotes = await loadViewerVotes(client, viewer?.user_id ?? null, 'post', [postId]);

  const tree = buildAnswerTree(
    answers ?? [],
    authorMap,
    answerVotes,
    viewer?.user_id ?? null,
    viewer?.is_admin ?? false
  );

  const detail: CommunityPostDetail = {
    id: post.id,
    title: post.title,
    excerpt: markdownExcerpt(post.body_markdown, 220),
    body_markdown: post.body_markdown,
    image_urls: post.image_urls ?? [],
    author: authorMap.get(post.author_id) ?? {
      user_id: post.author_id,
      pseudonym: 'former_member',
      avatar_url: null,
      karma: 0,
      is_public: false,
      top_badges: [],
    },
    barrier_tags: post.barrier_tags ?? [],
    category_tags: post.category_tags ?? [],
    upvotes: post.upvotes,
    downvotes: post.downvotes,
    score: post.score,
    answer_count: post.answer_count,
    view_count: post.view_count + 1,
    is_solved: post.accepted_answer_id != null,
    solved_tldr: post.solved_tldr,
    solved_key_insight: post.solved_key_insight,
    is_locked: post.is_locked,
    has_images: (post.image_urls?.length ?? 0) > 0,
    last_activity_at: post.last_activity_at,
    created_at: post.created_at,
    viewer_vote: postVotes.get(post.id) ?? 0,
    answers: tree,
    viewer_can_edit: !!viewer && viewer.user_id === post.author_id,
    viewer_can_accept:
      !!viewer && (viewer.user_id === post.author_id || viewer.is_admin),
    viewer_can_moderate: !!viewer && viewer.is_admin,
  };

  return NextResponse.json({ post: detail });
}

interface PatchBody {
  title?: string;
  body_markdown?: string;
  barrier_tags?: string[];
  category_tags?: string[];
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
  const postId = params.id;

  const { data: post } = await client
    .from('community_posts')
    .select('author_id, is_locked, is_deleted')
    .eq('id', postId)
    .maybeSingle();
  if (!post || post.is_deleted) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }
  if (post.is_locked && !viewer.is_admin) {
    return NextResponse.json({ error: 'Post is locked' }, { status: 403 });
  }
  if (post.author_id !== viewer.user_id && !viewer.is_admin) {
    return NextResponse.json({ error: 'Not your post' }, { status: 403 });
  }

  let body: PatchBody = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (t.length < 8 || t.length > 250) {
      return NextResponse.json({ error: 'Title must be 8-250 characters' }, { status: 400 });
    }
    update.title = t;
  }
  if (typeof body.body_markdown === 'string') {
    const m = body.body_markdown.trim();
    if (m.length < 20 || m.length > 30000) {
      return NextResponse.json({ error: 'Body must be 20-30,000 characters' }, { status: 400 });
    }
    update.body_markdown = m;
  }
  if (Array.isArray(body.barrier_tags)) {
    update.barrier_tags = body.barrier_tags
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t && t.length <= 32)
      .slice(0, 10);
  }
  if (Array.isArray(body.category_tags)) {
    update.category_tags = body.category_tags
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t && t.length <= 32)
      .slice(0, 5);
  }
  if (Array.isArray(body.image_urls)) {
    update.image_urls = body.image_urls
      .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
      .slice(0, 6);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }
  const { error } = await client.from('community_posts').update(update).eq('id', postId);
  if (error) {
    console.error('[community] PATCH /posts/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
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
  const postId = params.id;

  const { data: post } = await client
    .from('community_posts')
    .select('author_id, is_deleted')
    .eq('id', postId)
    .maybeSingle();
  if (!post || post.is_deleted) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }
  if (post.author_id !== viewer.user_id && !viewer.is_admin) {
    return NextResponse.json({ error: 'Not your post' }, { status: 403 });
  }

  const { error } = await client
    .from('community_posts')
    .update({
      is_deleted: true,
      deleted_by: viewer.user_id,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', postId);
  if (error) {
    console.error('[community] DELETE /posts/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
