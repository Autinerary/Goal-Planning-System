/**
 * /api/community/profiles/[id]
 *   GET   — public-facing community profile (visibility-filtered).
 *   PATCH — update one's own profile (pseudonym, bio, visibility flags).
 *           Only the owner can edit. Admins can edit via the admin route.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';
import { resolveVisibility } from '@/lib/community/visibility';
import { validatePseudonym } from '@/lib/community/pseudonym';
import { loadAuthorMap } from '@/lib/community/hydrate';
import { markdownExcerpt } from '@/lib/community/markdown';
import type {
  CommunityProfilePublic,
  CommunityPostSummary,
  CommunityAnswerSummary,
} from '@/types/community';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  const targetId = params.id;

  const { data: profile, error } = await client
    .from('community_profiles')
    .select(
      'user_id, pseudonym, bio, avatar_url, is_public, show_posts, show_answers, show_paths, show_tasks, show_calendar, karma, is_suspended, created_at, updated_at, suspended_reason, suspended_until'
    )
    .eq('user_id', targetId)
    .maybeSingle();
  if (error) {
    console.error('[community] GET /profiles/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const v = resolveVisibility(profile, {
    viewer_id: viewer?.user_id ?? null,
    is_admin: viewer?.is_admin ?? false,
  });
  if (!v.can_view_profile) {
    return NextResponse.json({ error: 'Profile is private' }, { status: 403 });
  }

  // Posts — only when allowed.
  let posts: CommunityPostSummary[] | null = null;
  if (v.can_view_posts) {
    const { data: postRows } = await client
      .from('community_posts')
      .select(
        'id, author_id, title, body_markdown, barrier_tags, category_tags, image_urls, upvotes, downvotes, score, answer_count, view_count, accepted_answer_id, solved_tldr, solved_key_insight, is_locked, last_activity_at, created_at'
      )
      .eq('author_id', targetId)
      .eq('is_deleted', false)
      .order('last_activity_at', { ascending: false })
      .limit(20);
    const authorMap = await loadAuthorMap(client, [targetId]);
    posts = (postRows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      excerpt: markdownExcerpt(r.body_markdown, 220),
      author: authorMap.get(r.author_id) ?? {
        user_id: r.author_id,
        pseudonym: profile.pseudonym,
        avatar_url: profile.avatar_url,
        karma: profile.karma,
        is_public: profile.is_public,
        top_badges: [],
      },
      barrier_tags: r.barrier_tags ?? [],
      category_tags: r.category_tags ?? [],
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      score: r.score,
      answer_count: r.answer_count,
      view_count: r.view_count,
      is_solved: r.accepted_answer_id != null,
      solved_tldr: r.solved_tldr,
      solved_key_insight: r.solved_key_insight,
      is_locked: r.is_locked,
      has_images: (r.image_urls?.length ?? 0) > 0,
      last_activity_at: r.last_activity_at,
      created_at: r.created_at,
      viewer_vote: 0,
    }));
  }

  // Answers — only when allowed.
  let answers: CommunityAnswerSummary[] | null = null;
  if (v.can_view_answers) {
    const { data: answerRows } = await client
      .from('community_answers')
      .select(
        'id, post_id, body_markdown, upvotes, downvotes, score, is_accepted, created_at'
      )
      .eq('author_id', targetId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20);
    answers = (answerRows ?? []).map((r) => ({
      id: r.id,
      post_id: r.post_id,
      body_markdown: markdownExcerpt(r.body_markdown, 220),
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      score: r.score,
      is_accepted: r.is_accepted,
      created_at: r.created_at,
    }));
  }

  // Badge grants.
  const { data: grants } = await client
    .from('community_badge_grants')
    .select(
      'id, user_id, badge_slug, granted_at, granted_by, badge:community_badges(slug, name, description, icon, tier, auto_metric, auto_threshold)'
    )
    .eq('user_id', targetId)
    .order('granted_at', { ascending: false });

  // Follow counts + viewer's follow state.
  const [{ count: follower_count }, { count: following_count }] = await Promise.all([
    client
      .from('community_follows')
      .select('followee_id', { count: 'exact', head: true })
      .eq('followee_id', targetId),
    client
      .from('community_follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('follower_id', targetId),
  ]);

  let is_followed_by_viewer = false;
  if (viewer && viewer.user_id !== targetId) {
    const { data: f } = await client
      .from('community_follows')
      .select('follower_id')
      .eq('follower_id', viewer.user_id)
      .eq('followee_id', targetId)
      .maybeSingle();
    is_followed_by_viewer = !!f;
  }

  const payload: CommunityProfilePublic = {
    user_id: profile.user_id,
    pseudonym: profile.pseudonym,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    karma: profile.karma,
    badges: (grants ?? []) as unknown as CommunityProfilePublic['badges'],
    posts,
    answers,
    follower_count: follower_count ?? 0,
    following_count: following_count ?? 0,
    is_followed_by_viewer,
  };
  return NextResponse.json({ profile: payload });
}

interface PatchBody {
  pseudonym?: string;
  bio?: string;
  avatar_url?: string;
  is_public?: boolean;
  show_posts?: boolean;
  show_answers?: boolean;
  show_paths?: boolean;
  show_tasks?: boolean;
  show_calendar?: boolean;
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
  if (viewer.user_id !== params.id && !viewer.is_admin) {
    return NextResponse.json({ error: 'Not your profile' }, { status: 403 });
  }

  let body: PatchBody = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.pseudonym === 'string') {
    const trimmed = body.pseudonym.trim();
    const err = validatePseudonym(trimmed);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    update.pseudonym = trimmed;
  }
  if (typeof body.bio === 'string') {
    update.bio = body.bio.slice(0, 1000);
  }
  if (typeof body.avatar_url === 'string') {
    if (body.avatar_url && !/^https?:\/\//i.test(body.avatar_url)) {
      return NextResponse.json({ error: 'avatar_url must be http(s)' }, { status: 400 });
    }
    update.avatar_url = body.avatar_url || null;
  }
  for (const k of [
    'is_public',
    'show_posts',
    'show_answers',
    'show_paths',
    'show_tasks',
    'show_calendar',
  ] as const) {
    if (typeof body[k] === 'boolean') update[k] = body[k];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Upsert in case the profile didn't exist yet (first edit from /settings).
  const { error } = await client
    .from('community_profiles')
    .upsert({ user_id: params.id, ...update }, { onConflict: 'user_id' });
  if (error) {
    console.error('[community] PATCH /profiles/[id] failed:', error.message);
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
