/**
 * /api/community/posts/[id]
 *   GET    — full post detail (with threaded answers + viewer state)
 *   PATCH  — edit a post (author, or an admin); publish or unpublish a Tidbit
 *   DELETE — soft-delete (author or admin)
 *
 * Who may edit is decided as the signed-in caller: their own session reads
 * the post (RLS lets authors and admins see it) and is_admin() answers for
 * moderators. The words then go through the automatic moderation, and the
 * server saves them: since STEP 83 people can't write posts straight into the
 * table, so a filter can't be walked around. DELETE calls
 * community_delete_post, which checks author or admin itself (STEP 58).
 */

import { primaryRelationship } from '@/lib/trust/authorRelationship'
import { NextRequest, NextResponse } from 'next/server';
import { isContentNote, missingContentNote } from '@/lib/community/contentNotes';
import { createClient } from '@/lib/supabase/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
  isCommunityAdmin,
} from '@/lib/community/client';
import { loadAuthorMap, loadViewerVotes } from '@/lib/community/hydrate';
import { markdownExcerpt } from '@/lib/community/markdown';
import { buildAnswerTree } from '@/lib/community/threading';
import { moderateFields, reviewFlag, SLUR_MESSAGE } from '@/lib/community/moderation';
import { LENGTHS, isLengthType, platformOf, shownAuthor, step83Missing, wordCount } from '@/lib/community/tidbits';
import { checkedItems, dbErrorMessage, loadGroups } from '@/lib/community/tidbitsServer';
import type { CommunityAuthorBadge, CommunityPostDetail, CommunityPostItem } from '@/types/community';

export const dynamic = 'force-dynamic';

const BASE_COLUMNS =
  'id, author_id, title, body_markdown, unlocking_moment, what_didnt_work, author_relationships, barrier_tags, category_tags, image_urls, upvotes, downvotes, score, answer_count, view_count, accepted_answer_id, solved_tldr, solved_key_insight, is_locked, locked_reason, locked_by, locked_at, is_deleted, last_activity_at, created_at, updated_at'
const TIDBIT_COLUMNS =
  'kind, length_type, status, is_anonymous, group_id, source, external_url, external_platform, external_platform_url, byline, word_count, published_at, bite_count, well_done_count, well_done_sum, item_count'

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

  // With the Tidbits columns (STEP 83) and the content note (STEP 75) when they are there.
  const load = (columns: string) => client.from('community_posts').select(columns).eq('id', postId).maybeSingle();
  let tidbits = true;
  let { data: post, error } = (await load(`${BASE_COLUMNS}, content_note, ${TIDBIT_COLUMNS}`)) as { data: any; error: any };
  if (error && step83Missing(error)) {
    tidbits = false;
    ({ data: post, error } = (await load(`${BASE_COLUMNS}, content_note`)) as { data: any; error: any });
  }
  if (missingContentNote(error)) ({ data: post, error } = (await load(BASE_COLUMNS)) as { data: any; error: any });
  if (error) {
    console.error('[community] GET /posts/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 });
  }
  const mine = !!viewer && !!post && viewer.user_id === post.author_id;
  // A draft is its author's (and moderators') only.
  if (!post || post.is_deleted || (post.status === 'draft' && !mine && !viewer?.is_admin)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  // Best-effort view counter; ignore failures.
  if (post.status !== 'draft') {
    try {
      await client
        .from('community_posts')
        .update({ view_count: post.view_count + 1 })
        .eq('id', postId);
    } catch (err) {
      console.warn('[community] view counter failed:', err);
    }
  }

  // Answers + their authors + viewer votes.
  const { data: answers } = await client
    .from('community_answers')
    .select(
      'id, post_id, parent_id, author_id, body_markdown, image_urls, upvotes, downvotes, score, is_accepted, accepted_at, created_at, updated_at, author_relationships, author_weight, quoted_text'
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

  // The Tidbit's own: its group, what it mentions, and the viewer's Bite and Well-Done.
  let group: { slug: string; name: string } | null = null;
  let items: CommunityPostItem[] = [];
  let viewerWellDone: number | null = null;
  let viewerBitten = false;
  if (tidbits && post.kind === 'tidbit') {
    if (post.group_id) group = (await loadGroups(client)).byId.get(post.group_id) ?? null;
    const { data: rows } = await client.from('community_post_items').select('item_kind, item_id, sort_order').eq('post_id', postId).order('sort_order');
    const ids = (k: string) => ((rows as any[]) ?? []).filter((r) => r.item_kind === k).map((r) => r.item_id);
    const [res, prod] = await Promise.all([
      ids('resource').length ? client.from('resources').select('id, name, category').in('id', ids('resource')) : { data: [] },
      ids('product').length ? client.from('products').select('id, name, category').in('id', ids('product')) : { data: [] },
    ]);
    const found = new Map<string, any>([
      ...((res.data as any[]) ?? []).map((r) => [`resource:${r.id}`, r] as [string, any]),
      ...((prod.data as any[]) ?? []).map((r) => [`product:${r.id}`, r] as [string, any]),
    ]);
    items = ((rows as any[]) ?? [])
      .map((r) => {
        const f = found.get(`${r.item_kind}:${r.item_id}`);
        return f ? { kind: r.item_kind, id: f.id, name: f.name, category: f.category ?? null, href: r.item_kind === 'product' ? `/shop/${f.id}` : `/resources/${f.id}` } : null;
      })
      .filter(Boolean) as CommunityPostItem[];
    if (viewer) {
      const [{ data: rating }, { data: read }] = await Promise.all([
        client.from('community_post_ratings').select('rating').eq('post_id', postId).eq('user_id', viewer.user_id).maybeSingle(),
        client.from('community_post_reads').select('post_id').eq('post_id', postId).eq('user_id', viewer.user_id).maybeSingle(),
      ]);
      viewerWellDone = (rating as any)?.rating ?? null;
      viewerBitten = !!read;
    }
  }

  const detail: CommunityPostDetail = {
    id: post.id,
    title: post.title,
    excerpt: markdownExcerpt(post.body_markdown, 220),
    body_markdown: post.body_markdown,
    content_note: isContentNote(post.content_note) ? post.content_note : null,
    unlocking_moment: post.unlocking_moment ?? null,
    what_didnt_work: post.what_didnt_work ?? null,
    author_relationship: post.is_anonymous || post.byline ? null : primaryRelationship(post.author_relationships),
    image_urls: post.image_urls ?? [],
    author: shownAuthor(post, authorMap.get(post.author_id) as any, viewer) as CommunityAuthorBadge,
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
    // Team articles (byline Autinerary) can be edited and published by any admin.
    viewer_can_edit: mine || (!!viewer?.is_admin && post.byline === 'autinerary'),
    viewer_can_accept: !!viewer && (mine || viewer.is_admin) && post.kind !== 'tidbit',
    viewer_can_moderate: !!viewer && viewer.is_admin,
    ...(tidbits
      ? {
          kind: post.kind,
          length_type: post.length_type ?? null,
          status: post.status,
          is_anonymous: !!post.is_anonymous,
          group,
          source: post.source,
          external_url: post.external_url ?? null,
          external_platform: post.external_platform ?? null,
          external_platform_url: post.external_platform_url ?? null,
          byline: post.byline ?? null,
          word_count: post.word_count ?? 0,
          published_at: post.published_at ?? null,
          bite_count: post.bite_count ?? 0,
          well_done_count: post.well_done_count ?? 0,
          well_done_avg: post.well_done_count ? Math.round((post.well_done_sum / post.well_done_count) * 10) / 10 : null,
          item_count: post.item_count ?? 0,
          items,
          viewer_well_done: viewerWellDone,
          viewer_bitten: viewerBitten,
          viewer_can_rate: !!viewer && !mine && post.kind === 'tidbit' && post.status === 'published',
        }
      : {}),
  };

  return NextResponse.json({ post: detail });
}

interface PatchBody {
  title?: string;
  body_markdown?: string;
  barrier_tags?: string[];
  category_tags?: string[];
  image_urls?: string[];
  content_note?: string | null;
  // The Tidbits round.
  length_type?: string;
  status?: string;
  is_anonymous?: boolean;
  group?: string;
  source?: string;
  external_url?: string | null;
  items?: { kind?: string; id?: string }[];
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
  const postId = params.id;

  let { data: post, error: readError } = (await supabase
    .from('community_posts')
    .select('author_id, is_locked, is_deleted, title, body_markdown, kind, status, length_type, source')
    .eq('id', postId)
    .maybeSingle()) as { data: any; error: any };
  const tidbits = !(readError && step83Missing(readError));
  if (!tidbits) {
    ({ data: post } = (await supabase.from('community_posts').select('author_id, is_locked, is_deleted, title, body_markdown').eq('id', postId).maybeSingle()) as { data: any; error: any });
  }
  if (!post || post.is_deleted) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }
  const isAuthor = post.author_id === user.id;
  // Ask only when it matters: a locked post, or someone else's.
  const isAdmin = post.is_locked || !isAuthor ? await isCommunityAdmin(supabase) : false;
  if (post.is_locked && !isAdmin) {
    return NextResponse.json({ error: 'Post is locked' }, { status: 403 });
  }
  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: 'Not your post' }, { status: 403 });
  }

  let body: PatchBody = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const status = tidbits && post.kind === 'tidbit' && (body.status === 'draft' || body.status === 'published') ? body.status : post.status ?? 'published';
  const draft = status === 'draft';
  const update: Record<string, unknown> = {};
  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (t.length > 250 || (!draft && t.length < 8)) {
      return NextResponse.json({ error: 'Title must be 8-250 characters' }, { status: 400 });
    }
    update.title = t;
  }
  if (typeof body.body_markdown === 'string') {
    const m = body.body_markdown.trim();
    if (m.length > 30000 || (!draft && m.length < 20)) {
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
  if (body.content_note !== undefined) update.content_note = isContentNote(body.content_note) ? body.content_note : null;

  // A Tidbit's own fields.
  const client = getCommunityServiceClient();
  if (!client) return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  if (tidbits && post.kind === 'tidbit') {
    update.status = status;
    if (isLengthType(body.length_type)) update.length_type = body.length_type;
    if (typeof body.is_anonymous === 'boolean') update.is_anonymous = body.is_anonymous;
    if (typeof body.group === 'string') {
      const g = (await loadGroups(client)).bySlug.get(body.group);
      if (!g) return NextResponse.json({ error: 'Choose one of your groups for it.' }, { status: 400 });
      update.group_id = g.id;
    }
    if (body.source === 'internal') Object.assign(update, { source: 'internal', external_url: null, external_platform: null, external_platform_url: null });
    if (body.source === 'external') {
      try {
        const u = new URL(String(body.external_url || '').trim());
        if (u.protocol !== 'https:') throw new Error('https');
        const platform = platformOf(u.toString());
        Object.assign(update, { source: 'external', external_url: u.toString().slice(0, 500), external_platform: platform?.name ?? null, external_platform_url: platform?.home ?? null });
      } catch {
        return NextResponse.json({ error: 'Add the link to the article you are reviewing (https://…).' }, { status: 400 });
      }
    }
    if (!draft) {
      const words = wordCount(String(update.body_markdown ?? post.body_markdown ?? ''));
      const lt = (update.length_type ?? post.length_type ?? 'tidbit') as 'tidbit' | 'tadbit';
      if (words > LENGTHS[lt].words) {
        return NextResponse.json({ error: `Keep it short and sweet! Please keep your ${LENGTHS[lt].label} under ${LENGTHS[lt].words} words.`, code: 'too_long' }, { status: 400 });
      }
    }
  }

  // Moderation: no slurs; swear words bleeped; on publishing, the rest checked for a moderator.
  const words = { title: update.title as string | undefined, body: update.body_markdown as string | undefined }
  const moderated = moderateFields(words);
  if (moderated.slur) return NextResponse.json({ error: SLUR_MESSAGE, code: 'slur' }, { status: 400 });
  if (moderated.fields.title !== undefined) update.title = moderated.fields.title;
  if (moderated.fields.body !== undefined) update.body_markdown = moderated.fields.body;
  const publishing = tidbits && post.kind === 'tidbit' && !draft && (post.status === 'draft' || update.title !== undefined || update.body_markdown !== undefined);
  if (publishing) {
    const review = await reviewFlag(`${update.title ?? post.title}\n\n${update.body_markdown ?? post.body_markdown}`);
    if (review.flag) Object.assign(update, { auto_flag: review.flag, auto_flag_reason: review.reason });
    if (review.selfHarm && body.content_note === undefined) update.content_note = 'self_harm';
  }

  const items = tidbits && post.kind === 'tidbit' && Array.isArray(body.items) ? await checkedItems(client, body.items) : null;
  if (Object.keys(update).length === 0 && !items) {
    return NextResponse.json({ ok: true });
  }
  let { data: updated, error } = await client.from('community_posts').update(update).eq('id', postId).select('id');
  if (error && missingContentNote(error) && 'content_note' in update) {
    delete update.content_note;
    ({ data: updated, error } = await client.from('community_posts').update(update).eq('id', postId).select('id'));
  }
  if (error) {
    const friendly = dbErrorMessage(error);
    if (friendly) return NextResponse.json({ error: friendly }, { status: 400 });
    console.error('[community] PATCH /posts/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
  if (!updated?.length) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (items) {
    await client.from('community_post_items').delete().eq('post_id', postId);
    if (items.length) await client.from('community_post_items').insert(items.map((i, n) => ({ post_id: postId, item_kind: i.kind, item_id: i.id, sort_order: n })));
  }
  return NextResponse.json({ ok: true, status, bleeped: moderated.bleeped });
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

  const { error } = await supabase.rpc('community_delete_post', { p_post_id: params.id });
  if (error) {
    if (error.code === 'P0002' || error.code === '22P02') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Not your post' }, { status: 403 });
    }
    console.error('[community] DELETE /posts/[id] failed:', error.message);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
