/**
 * /api/community/posts/[id]/answers
 *   POST { body_markdown, parent_id?, image_urls? } — add an answer or
 *   threaded reply to an existing answer.
 *
 * Threaded: pass `parent_id` to reply to another answer instead of the
 * post itself.
 */

import { authorRelationshipSnapshot } from '@/lib/trust/authorRelationship'
import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';
import { generatePseudonym } from '@/lib/community/pseudonym';
import { moderateText, reviewFlag, SLUR_MESSAGE } from '@/lib/community/moderation';
import { rulesAccepted } from '@/lib/community/tidbitsServer';

export const dynamic = 'force-dynamic';

interface Body {
  body_markdown?: string;
  parent_id?: string | null;
  image_urls?: string[];
  /** Passage of the post this reply responds to (Odosa's "Comment on"). */
  quoted_text?: string | null;
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
  let { data: post, error: postError } = (await client
    .from('community_posts')
    .select('id, is_locked, is_deleted, status')
    .eq('id', postId)
    .maybeSingle()) as { data: any; error: any };
  // Before STEP 83 there is no status: every post is published.
  if (postError) ({ data: post } = (await client.from('community_posts').select('id, is_locked, is_deleted').eq('id', postId).maybeSingle()) as { data: any; error: any });
  if (!post || post.is_deleted || post.status === 'draft') {
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
  const raw = (body.body_markdown ?? '').trim();
  if (raw.length < 10 || raw.length > 30000) {
    return NextResponse.json({ error: 'Body must be 10-30,000 characters' }, { status: 400 });
  }
  // The community rules, once (STEP 83), and the words checked (the Tidbits round, Goal 6).
  if ((await rulesAccepted(client, viewer.user_id)) === false) {
    return NextResponse.json({ error: 'Please read and agree to the community rules first.', code: 'rules' }, { status: 403 });
  }
  const moderated = moderateText(raw);
  if (moderated.slur) return NextResponse.json({ error: SLUR_MESSAGE, code: 'slur' }, { status: 400 });
  const markdown = moderated.text;
  const review = await reviewFlag(markdown);
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

  const authorRel = await authorRelationshipSnapshot(viewer.user_id)

  const { data: answer, error } = await client
    .from('community_answers')
    .insert({
      post_id: postId,
      parent_id: parentId,
      author_id: viewer.user_id,
      body_markdown: markdown,
      image_urls: imageUrls,
      author_relationships: authorRel.relationships,
      author_weight: authorRel.weight,
      ...(review.flag ? { auto_flag: review.flag, auto_flag_reason: review.reason } : {}),
      // Odosa's "Comment on": the passage this reply responds to. Trimmed
      // and length-capped here as well as in the DB CHECK, so an
      // over-long selection fails cleanly instead of as a 500.
      quoted_text: (() => {
        const q = typeof body?.quoted_text === 'string' ? body.quoted_text.trim() : ''
        return q ? q.slice(0, 1000) : null
      })(),
    })
    .select('id')
    .single();
  if (error || !answer) {
    console.error('[community] POST /answers failed:', error?.message);
    return NextResponse.json({ error: 'Failed to create answer' }, { status: 500 });
  }
  return NextResponse.json({ id: answer.id, bleeped: moderated.bleeped }, { status: 201 });
}
