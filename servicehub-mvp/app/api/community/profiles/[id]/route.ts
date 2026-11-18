/**
 * /api/community/profiles/[id]
 *   GET   — public-facing community profile (visibility-filtered).
 *   PATCH — update a profile (pseudonym, bio, visibility flags): the owner,
 *           or an admin (public.admin_users). Runs as the signed-in caller
 *           under RLS (community_profiles_owner, or the admin policies in
 *           STEP 58), not with the service-role key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
  isCommunityAdmin,
  postingBlockedReason,
} from '@/lib/community/client';
import { isOwnImageUrl } from '@/lib/community/images';
import { step83Missing } from '@/lib/community/tidbits';
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

  // The owner and moderators see everything here; anyone else sees only
  // published posts that carry the name. Drafts and anonymous Tidbits used to
  // be listed on the author's public profile, which named the author of an
  // anonymous one (bug audit, 17 November 2026, item 3).
  const privileged = !!viewer && (viewer.user_id === targetId || viewer.is_admin);

  // Posts — only when allowed.
  let posts: CommunityPostSummary[] | null = null;
  if (v.can_view_posts) {
    const postQuery = (shownOnly: boolean) => {
      let q = client
        .from('community_posts')
        .select(
          'id, author_id, title, body_markdown, barrier_tags, category_tags, image_urls, upvotes, downvotes, score, answer_count, view_count, accepted_answer_id, solved_tldr, solved_key_insight, is_locked, last_activity_at, created_at'
        )
        .eq('author_id', targetId)
        .eq('is_deleted', false);
      if (shownOnly) q = q.eq('status', 'published').eq('is_anonymous', false);
      return q.order('last_activity_at', { ascending: false }).limit(20);
    };
    let { data: postRows, error: postsError } = await postQuery(!privileged);
    // Before STEP 83 there are no drafts or anonymous posts to leave out.
    if (postsError && !privileged && step83Missing(postsError)) {
      ({ data: postRows, error: postsError } = await postQuery(false));
    }
    if (postsError) console.error('[community] GET /profiles/[id] posts failed:', postsError.message);
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
    // Only answers on posts this viewer may open: not on a deleted post or a
    // draft (a Tidbit taken back to draft keeps its replies).
    let shownAnswers = answerRows ?? [];
    if (!privileged && shownAnswers.length > 0) {
      const postIds = Array.from(new Set(shownAnswers.map((r) => r.post_id)));
      let { data: open, error: openError } = (await client
        .from('community_posts')
        .select('id, is_deleted, status')
        .in('id', postIds)) as { data: any[] | null; error: any };
      if (openError && step83Missing(openError)) {
        ({ data: open, error: openError } = (await client
          .from('community_posts')
          .select('id, is_deleted')
          .in('id', postIds)) as { data: any[] | null; error: any });
      }
      const openIds = new Set(
        (open ?? []).filter((p) => !p.is_deleted && (p.status ?? 'published') === 'published').map((p) => p.id)
      );
      shownAnswers = openError ? [] : shownAnswers.filter((r) => openIds.has(r.post_id));
    }
    answers = shownAnswers.map((r) => ({
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
  /** A picture from /api/community/upload, or null (or '') to remove it. */
  avatar_url?: string | null;
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });
  const isOwner = user.id === params.id;
  if (!isOwner && !(await isCommunityAdmin(supabase))) {
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
  // What the profile says now, to tell a change from the same values sent
  // again (the settings page saves the whole form).
  const { data: currentRow } = await supabase
    .from('community_profiles')
    .select('pseudonym, bio, avatar_url')
    .eq('user_id', params.id)
    .maybeSingle();
  const current = (currentRow ?? {}) as { pseudonym?: string | null; bio?: string | null; avatar_url?: string | null };

  // null (or '') removes the picture; it used to be ignored, so a removed
  // picture came back (bug audit, item 33). A new one must come from our own
  // storage (/api/community/upload); the one already there may be kept.
  if (body.avatar_url === null || typeof body.avatar_url === 'string') {
    const wanted = body.avatar_url ? body.avatar_url.trim() : '';
    if (wanted && !isOwnImageUrl(wanted) && wanted !== current.avatar_url) {
      return NextResponse.json({ error: 'Please upload the picture here, rather than linking to one.' }, { status: 400 });
    }
    update.avatar_url = wanted || null;
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

  // Someone who can't post right now (banned or suspended) can still hide
  // their profile or clear it, but not give it a new name, words or picture.
  const changesWords =
    (update.pseudonym !== undefined && update.pseudonym !== current.pseudonym) ||
    (!!update.bio && update.bio !== (current.bio ?? '')) ||
    (!!update.avatar_url && update.avatar_url !== current.avatar_url);
  if (isOwner && changesWords) {
    const blocked = await postingBlockedReason(user.id);
    if (blocked) return NextResponse.json({ error: blocked, code: 'blocked' }, { status: 403 });
  }

  if (isOwner) {
    // Upsert in case the profile didn't exist yet (first edit from /settings).
    const { error } = await supabase
      .from('community_profiles')
      .upsert({ user_id: params.id, ...update }, { onConflict: 'user_id' });
    if (error) {
      console.error('[community] PATCH /profiles/[id] failed:', error.message);
      return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // An admin edits a profile that exists. They never create one for someone
  // who has not opted in to the community.
  const { data: updated, error } = await supabase
    .from('community_profiles')
    .update(update)
    .eq('user_id', params.id)
    .select('user_id');
  if (error) {
    console.error('[community] PATCH /profiles/[id] failed:', error.message);
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
  if (!updated?.length) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
