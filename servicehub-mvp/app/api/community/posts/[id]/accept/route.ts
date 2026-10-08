/**
 * /api/community/posts/[id]/accept
 *   POST { answer_id, key_insight, tldr } — accept an answer and stamp the
 *   post with the mandatory Solved line.
 *
 * This is the flagship feature: marking solved REQUIRES both a key insight
 * and a 1-3 sentence TLDR. Empty values are rejected here AND at the DB
 * layer (CHECK constraint), so the requirement is enforced even if a
 * developer bypasses this endpoint.
 *
 * Runs as the signed-in caller: community_accept_answer takes who is acting
 * from the session and allows the post's author or an admin
 * (public.admin_users), not the service-role key and an id we pass (STEP 58).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateSolvedPayload } from '@/lib/community/solved';

export const dynamic = 'force-dynamic';

interface Body {
  answer_id?: string;
  key_insight?: string;
  tldr?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const answerId = body.answer_id;
  const keyInsight = (body.key_insight ?? '').trim();
  const tldr = (body.tldr ?? '').trim();

  if (!answerId) return NextResponse.json({ error: 'answer_id is required' }, { status: 400 });

  const validation = validateSolvedPayload(keyInsight, tldr);
  if (validation) {
    return NextResponse.json({ error: validation }, { status: 400 });
  }

  const { error } = await client.rpc('community_accept_answer', {
    p_post_id: params.id,
    p_answer_id: answerId,
    p_acting_user_id: user.id,
    p_tldr: tldr,
    p_key_insight: keyInsight,
  });
  if (error) {
    // The RPC raises descriptive errors which are safe to surface.
    console.error('[community] accept_answer failed:', error.message);
    return NextResponse.json({ error: error.message || 'Accept failed' }, { status: 400 });
  }

  // Threshold badges might have changed (e.g. mentor badge after 10 accepts).
  try {
    const { data: answer } = await client
      .from('community_answers')
      .select('author_id')
      .eq('id', answerId)
      .maybeSingle();
    if (answer?.author_id) {
      await client.rpc('community_award_threshold_badges', {
        p_user_id: answer.author_id,
      });
    }
  } catch (err) {
    console.warn('[community] threshold badge award failed after accept:', err);
  }

  return NextResponse.json({ ok: true });
}
