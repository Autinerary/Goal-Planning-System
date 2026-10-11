/**
 * /api/community/answers/[id]
 *   PATCH  — edit body_markdown / image_urls (author, or an admin)
 *   DELETE — soft-delete (author or admin)
 *
 * Both run as the signed-in caller, not with the service-role key. PATCH is
 * under RLS: the author under community_answers_update, an admin
 * (public.admin_users) under community_answers_admin_update. DELETE calls
 * community_delete_answer, which checks author or admin itself (STEP 58).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isCommunityAdmin } from '@/lib/community/client';

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
    .select('author_id, post_id, is_deleted')
    .eq('id', params.id)
    .maybeSingle();
  if (!answer || answer.is_deleted) {
    return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
  }
  if (answer.author_id !== user.id && !(await isCommunityAdmin(supabase))) {
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
  const { data: updated, error } = await supabase
    .from('community_answers')
    .update(update)
    .eq('id', params.id)
    .select('id');
  if (error) {
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
