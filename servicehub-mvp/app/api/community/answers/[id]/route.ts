/**
 * /api/community/answers/[id]
 *   PATCH  — edit body_markdown / image_urls (author, or an admin)
 *   DELETE — soft-delete (author or admin)
 *
 * Who may edit is decided as the signed-in caller (their session reads the
 * answer; is_admin() answers for moderators). The words then go through the
 * same automatic moderation as a new answer (slurs refused, swear words
 * bleeped, the AI check marking it for a moderator); edits used to skip the
 * AI check (bug audit, 17 November 2026, item 16). The server saves them:
 * since STEP 83 people can't write answers straight into the table. An answer
 * on a locked post can't be edited, except by a moderator. DELETE calls
 * community_delete_answer, which checks author or admin itself (STEP 58).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  CANT_POST_MESSAGE,
  getCommunityServiceClient,
  isCommunityAdmin,
  isPostingBlockedError,
  postingBlockedReason,
} from '@/lib/community/client';
import { keptImageUrls } from '@/lib/community/images';
import { LOCKED_MESSAGE, loadPostState } from '@/lib/community/locks';
import { moderateText, reviewFlag, SLUR_MESSAGE } from '@/lib/community/moderation';

export const dynamic = 'force-dynamic';

interface PatchBody {
  body_markdown?: string;
  image_urls?: string[];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });

  const { data: answer } = await supabase
    .from('community_answers')
    .select('author_id, post_id, is_deleted, body_markdown, image_urls')
    .eq('id', params.id)
    .maybeSingle();
  if (!answer || answer.is_deleted) {
    return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
  }
  const isAdmin = await isCommunityAdmin(supabase);
  if (answer.author_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Not your answer' }, { status: 403 });
  }
  if (!isAdmin) {
    const blocked = await postingBlockedReason(user.id);
    if (blocked) return NextResponse.json({ error: blocked, code: 'blocked' }, { status: 403 });
  }

  const client = getCommunityServiceClient();
  if (!client) return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  // A locked post's answers stay as they are, except for moderators.
  const post = await loadPostState(client, answer.post_id);
  if (post?.is_locked && !isAdmin) {
    return NextResponse.json({ error: LOCKED_MESSAGE, code: 'locked' }, { status: 403 });
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
    const moderated = moderateText(m);
    if (moderated.slur) return NextResponse.json({ error: SLUR_MESSAGE, code: 'slur' }, { status: 400 });
    // Changed words get the same AI check as a new answer: anything it flags
    // is saved but marked for a moderator.
    if (moderated.text !== answer.body_markdown) {
      update.body_markdown = moderated.text;
      const review = await reviewFlag(moderated.text);
      if (review.flag) Object.assign(update, { auto_flag: review.flag, auto_flag_reason: review.reason });
    }
  }
  if (Array.isArray(body.image_urls)) {
    // Pictures from our own storage only; the ones it already had may stay.
    update.image_urls = keptImageUrls(body.image_urls, Array.isArray(answer.image_urls) ? answer.image_urls : []);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }
  const { data: updated, error } = await client
    .from('community_answers')
    .update(update)
    .eq('id', params.id)
    .select('id');
  if (error) {
    if (isPostingBlockedError(error)) {
      return NextResponse.json({ error: CANT_POST_MESSAGE, code: 'blocked' }, { status: 403 });
    }
    console.error('[community] PATCH /answers/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to update answer' }, { status: 500 });
  }
  if (!updated?.length) return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });

  const { error } = await supabase.rpc('community_delete_answer', { p_answer_id: params.id });
  if (error) {
    if (error.code === 'P0002' || error.code === '22P02') {
      return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
    }
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Not your answer' }, { status: 403 });
    }
    console.error('[community] DELETE /answers/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to delete answer' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
