/**
 * /api/community/admin/reports
 *   GET — list open reports (with target previews) for the moderation queue.
 *
 * Admin-only. The queue page (/admin/community) uses this directly.
 */

import { NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';
import type { CommunityReportEnriched } from '@/types/community';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ reports: [] }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  if (!viewer || !viewer.is_admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { data: reports, error } = await client
    .from('community_reports')
    .select(
      'id, reporter_id, target_type, target_id, reason, status, resolved_by, resolution_note, resolved_at, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[community] admin reports load failed:', error.message);
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
  }

  const postIds = (reports ?? [])
    .filter((r) => r.target_type === 'post')
    .map((r) => r.target_id);
  const answerIds = (reports ?? [])
    .filter((r) => r.target_type === 'answer')
    .map((r) => r.target_id);
  const userIds = (reports ?? [])
    .filter((r) => r.target_type === 'user')
    .map((r) => r.target_id);
  const reporterIds = Array.from(new Set((reports ?? []).map((r) => r.reporter_id)));

  const [postsRes, answersRes, profilesRes] = await Promise.all([
    postIds.length
      ? client
          .from('community_posts')
          .select('id, title, body_markdown, author_id')
          .in('id', postIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; body_markdown: string; author_id: string }> }),
    answerIds.length
      ? client
          .from('community_answers')
          .select('id, post_id, body_markdown, author_id')
          .in('id', answerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; post_id: string; body_markdown: string; author_id: string }> }),
    client
      .from('community_profiles')
      .select('user_id, pseudonym')
      .in('user_id', Array.from(new Set([...reporterIds, ...userIds]))),
  ]);

  const postMap = new Map((postsRes.data ?? []).map((p) => [p.id, p]));
  const answerMap = new Map((answersRes.data ?? []).map((a) => [a.id, a]));
  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id, p.pseudonym] as const)
  );

  const enriched: CommunityReportEnriched[] = (reports ?? []).map((r) => {
    let target_title: string | null = null;
    let target_excerpt: string | null = null;
    let target_author_id: string | null = null;
    if (r.target_type === 'post') {
      const p = postMap.get(r.target_id);
      target_title = p?.title ?? null;
      target_excerpt = p?.body_markdown?.slice(0, 200) ?? null;
      target_author_id = p?.author_id ?? null;
    } else if (r.target_type === 'answer') {
      const a = answerMap.get(r.target_id);
      target_excerpt = a?.body_markdown?.slice(0, 200) ?? null;
      target_author_id = a?.author_id ?? null;
    } else {
      target_author_id = r.target_id;
    }
    return {
      ...r,
      reporter_pseudonym: profileMap.get(r.reporter_id) ?? null,
      target_title,
      target_excerpt,
      target_author_id,
      target_author_pseudonym: target_author_id
        ? profileMap.get(target_author_id) ?? null
        : null,
    };
  });

  return NextResponse.json({ reports: enriched });
}
