/**
 * /api/community/posts
 *   GET  — paginated feed with sort + filters
 *   POST — create a question or a Tidbit (requires a signed-in person)
 *
 * The Tidbits round (STEP 83): Tidbits (at most 500 words) and Tadbits (at
 * most 1000) beside questions; drafts; anonymous Tidbits; the source (our
 * own, or a review of an article elsewhere); Integrated Resources; the
 * community rules, accepted once; and the automatic moderation
 * (lib/community/moderation.ts). Before STEP 83 the feed and questions work
 * as before, and Tidbits say they open soon.
 */

import { authorRelationshipSnapshot } from '@/lib/trust/authorRelationship'
import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';
import { isContentNote, missingContentNote } from '@/lib/community/contentNotes';
import { loadAuthorMap, loadViewerVotes } from '@/lib/community/hydrate';
import { generatePseudonym } from '@/lib/community/pseudonym';
import { moderateFields, reviewFlag, SLUR_MESSAGE } from '@/lib/community/moderation';
import { LENGTHS, isLengthType, platformOf, searchWords, step83Missing, wordCount } from '@/lib/community/tidbits';
import { checkedItems, dbErrorMessage, loadGroups, rulesAccepted, summarize } from '@/lib/community/tidbitsServer';
import type { CommunityPostSummary, FeedSort } from '@/types/community';

export const dynamic = 'force-dynamic';

const SORTS: ReadonlyArray<FeedSort> = ['recent', 'best', 'top', 'unanswered', 'solved', 'solutions'];

function parseSort(input: string | null): FeedSort {
  if (!input) return 'recent';
  return (SORTS as string[]).includes(input) ? (input as FeedSort) : 'recent';
}

const BASE_COLUMNS =
  'id, author_id, title, body_markdown, unlocking_moment, what_didnt_work, author_relationships, barrier_tags, category_tags, image_urls, upvotes, downvotes, score, answer_count, view_count, accepted_answer_id, solved_tldr, solved_key_insight, is_locked, last_activity_at, created_at'
const TIDBIT_COLUMNS =
  'kind, length_type, status, is_anonymous, group_id, source, external_url, external_platform, external_platform_url, byline, word_count, published_at, bite_count, well_done_count, well_done_sum, item_count'

export async function GET(request: NextRequest) {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ posts: [], page: 1, page_size: 0 }, { status: 503 });
  }
  const viewer = await getCommunityViewer();

  const url = new URL(request.url);
  const sort = parseSort(url.searchParams.get('sort'));
  const q = url.searchParams.get('q')?.trim().replace(/[%,()]/g, ' ').slice(0, 100) || null;
  // Accept comma-separated lists so the filter sidebar can multi-select.
  // Single values still work — the old `?barrier=autism` links are unchanged.
  const parseList = (v: string | null): string[] =>
    (v || '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  const barriers = parseList(url.searchParams.get('barrier'));
  const categories = parseList(url.searchParams.get('category'));
  const author = url.searchParams.get('author')?.trim() || null;
  // The Tidbits round's filters: what kind, how long, where from, with resources, in a group.
  const kind = url.searchParams.get('kind');
  const length = url.searchParams.get('length');
  const source = url.searchParams.get('source');
  const integrated = url.searchParams.get('integrated') === '1';
  const groupSlug = url.searchParams.get('group')?.trim() || null;
  const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
  const sizeRaw = parseInt(url.searchParams.get('page_size') ?? '20', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Math.min(50, Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : 20);
  const offset = (page - 1) * pageSize;
  const wantsTidbitFilters = Boolean((kind && kind !== 'all') || length || source || integrated || groupSlug || sort === 'best');

  const groups = await loadGroups(client);
  const group = groupSlug ? groups.bySlug.get(groupSlug) : null;
  if (groupSlug && !group) return NextResponse.json({ posts: [], page, page_size: pageSize });

  const build = (columns: string, tidbits: boolean) => {
    let query = client.from('community_posts').select(columns).eq('is_deleted', false);
    if (tidbits) {
      // Drafts are only ever their author's (in "My Tidbits"); an anonymous
      // Tidbit never shows on its author's public list.
      query = query.eq('status', 'published');
      if (kind === 'tidbit' || kind === 'question') query = query.eq('kind', kind);
      if (length === 'tidbit' || length === 'tadbit' || length === 'guide') query = query.eq('length_type', length);
      if (source === 'external') query = query.eq('source', 'external');
      if (source === 'internal') query = query.eq('source', 'internal');
      if (source === 'internal_rated') query = query.eq('source', 'internal').gt('well_done_count', 0);
      if (source === 'internal_unrated') query = query.eq('source', 'internal').eq('well_done_count', 0);
      if (integrated) query = query.gt('item_count', 0);
      if (group) query = query.eq('group_id', group.id);
      if (author) query = query.eq('is_anonymous', false);
    }
    // overlaps, not contains: selecting three norms should widen the results
    // (posts matching ANY of them), not demand a post carry all three.
    if (barriers.length) query = query.overlaps('barrier_tags', barriers);
    if (categories.length) query = query.overlaps('category_tags', categories);
    if (author) query = query.eq('author_id', author);
    // Every word, in any order (lib/community/tidbits.ts searchWords); the
    // text as typed when it has no word worth searching for.
    const words = searchWords(q);
    if (words.length) for (const w of words) query = query.or(`title.ilike.%${w}%,body_markdown.ilike.%${w}%`);
    else if (q) query = query.or(`title.ilike.%${q}%,body_markdown.ilike.%${q}%`);
    if (sort === 'unanswered') query = query.eq('answer_count', 0);
    if (sort === 'solved') query = query.not('accepted_answer_id', 'is', null);
    // Solutions: the author highlighted what unlocked it. Independent of
    // whether anyone's answer was accepted.
    if (sort === 'solutions') query = query.not('unlocking_moment', 'is', null);

    if (sort === 'top') {
      query = query.order('score', { ascending: false }).order('last_activity_at', { ascending: false });
    } else if (sort === 'best' && tidbits) {
      query = query.order('well_done_score', { ascending: false }).order('published_at', { ascending: false });
    } else {
      query = query.order('last_activity_at', { ascending: false });
    }
    query = query.range(offset, offset + pageSize - 1);
    return query;
  };

  let tidbits = true;
  let { data: rows, error } = (await build(`${BASE_COLUMNS}, content_note, ${TIDBIT_COLUMNS}`, true)) as { data: any[] | null; error: any };
  if (error && step83Missing(error)) {
    // Before STEP 83: questions only; a Tidbits filter matches nothing yet.
    tidbits = false;
    if (wantsTidbitFilters && kind !== 'question') return NextResponse.json({ posts: [], page, page_size: pageSize, tidbits: false });
    ({ data: rows, error } = (await build(`${BASE_COLUMNS}, content_note`, false)) as { data: any[] | null; error: any });
  }
  if (missingContentNote(error)) ({ data: rows, error } = (await build(BASE_COLUMNS, false)) as { data: any[] | null; error: any });
  if (error) {
    console.error('[community] GET /posts failed:', error.message);
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 });
  }

  const authorMap = await loadAuthorMap(client, (rows ?? []).map((r) => r.author_id));
  const votes = await loadViewerVotes(client, viewer?.user_id ?? null, 'post', (rows ?? []).map((r) => r.id));
  const posts: CommunityPostSummary[] = (rows ?? []).map((r) =>
    summarize(r, authorMap.get(r.author_id), viewer, votes.get(r.id) ?? 0, r.group_id ? groups.byId.get(r.group_id) ?? null : null)
  );

  // The Chef's pick (the best-post promotion): the best-rated Tidbit of the
  // last week, with at least three Well-Dones, on the first page.
  let chefs_pick: CommunityPostSummary | null = null;
  if (tidbits && page === 1 && kind !== 'question' && !q && !author) {
    const { data: pick } = await client
      .from('community_posts')
      .select(`${BASE_COLUMNS}, content_note, ${TIDBIT_COLUMNS}`)
      .eq('is_deleted', false)
      .eq('status', 'published')
      .eq('kind', 'tidbit')
      .gte('well_done_count', 3)
      .gte('published_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order('well_done_score', { ascending: false })
      .limit(1);
    const p = (pick as any[] | null)?.[0];
    if (p) {
      const pm = await loadAuthorMap(client, [p.author_id]);
      chefs_pick = summarize(p, pm.get(p.author_id), viewer, 0, p.group_id ? groups.byId.get(p.group_id) ?? null : null);
    }
  }

  return NextResponse.json({ posts, page, page_size: pageSize, tidbits, chefs_pick });
}

interface CreatePostBody {
  content_note?: string;
  title?: string;
  body_markdown?: string;
  barrier_tags?: string[];
  category_tags?: string[];
  image_urls?: string[];
  unlocking_moment?: string;
  what_didnt_work?: string;
  // The Tidbits round.
  kind?: string;
  length_type?: string;
  status?: string;
  is_anonymous?: boolean;
  group?: string;
  source?: string;
  external_url?: string;
  external_platform?: string;
  items?: { kind?: string; id?: string }[];
  byline?: string;
}

export async function POST(request: NextRequest) {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  if (!viewer) {
    return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });
  }

  let body: CreatePostBody = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const kind = body.kind === 'tidbit' ? 'tidbit' : 'question';
  const status = kind === 'tidbit' && body.status === 'draft' ? 'draft' : 'published';
  const draft = status === 'draft';
  const title = (body.title ?? '').trim();
  const markdown = (body.body_markdown ?? '').trim();
  const barrier_tags = (body.barrier_tags ?? [])
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t && t.length <= 32)
    .slice(0, 10);
  const category_tags = (body.category_tags ?? [])
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t && t.length <= 32)
    .slice(0, 5);
  const image_urls = (body.image_urls ?? [])
    .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
    .slice(0, 6);
  // Author-highlighted key sentence / unlocking moment (optional).
  const unlocking_moment = (body.unlocking_moment ?? '').trim().slice(0, 280) || null;
  // Author-highlighted things that did NOT work (optional).
  const what_didnt_work = (body.what_didnt_work ?? '').trim().slice(0, 280) || null;
  // A content note, from the fixed list (lib/community/contentNotes.ts).
  let content_note = isContentNote(body.content_note) ? body.content_note : null;

  if (title.length > 250 || (!draft && title.length < 8)) {
    return NextResponse.json({ error: 'Title must be 8-250 characters' }, { status: 400 });
  }
  if (markdown.length > 30000 || (!draft && markdown.length < 20)) {
    return NextResponse.json({ error: 'Body must be 20-30,000 characters' }, { status: 400 });
  }

  // A Tidbit: how long, where from, which group, and whether anonymous.
  const length_type = kind === 'tidbit' ? (isLengthType(body.length_type) ? body.length_type : 'tidbit') : null;
  if (kind === 'tidbit' && !draft) {
    const limit = LENGTHS[length_type as 'tidbit' | 'tadbit'].words;
    if (wordCount(markdown) > limit) {
      return NextResponse.json({ error: `Keep it short and sweet! Please keep your ${LENGTHS[length_type as 'tidbit'].label} under ${limit} words.`, code: 'too_long' }, { status: 400 });
    }
  }
  const byline = body.byline === 'autinerary' && viewer.is_admin ? 'autinerary' : null;
  const source = kind === 'tidbit' && body.source === 'external' ? 'external' : 'internal';
  let external_url: string | null = null;
  let external_platform: string | null = null;
  let external_platform_url: string | null = null;
  if (source === 'external') {
    try {
      const u = new URL(String(body.external_url || '').trim());
      if (u.protocol !== 'https:') throw new Error('https');
      external_url = u.toString().slice(0, 500);
    } catch {
      return NextResponse.json({ error: 'Add the link to the article you are reviewing (https://…).' }, { status: 400 });
    }
    const platform = platformOf(external_url);
    external_platform = String(body.external_platform || platform?.name || '').trim().slice(0, 60) || null;
    external_platform_url = platform?.home ?? null;
  }

  const groups = kind === 'tidbit' ? await loadGroups(client) : null;
  const group = body.group ? groups?.bySlug.get(String(body.group)) ?? null : null;
  if (kind === 'tidbit' && !draft && !byline && !group) {
    return NextResponse.json({ error: 'Choose one of your groups for it.', code: 'group' }, { status: 400 });
  }
  const is_anonymous = kind === 'tidbit' && body.is_anonymous === true;

  // The community rules, once (STEP 83).
  const accepted = await rulesAccepted(client, viewer.user_id);
  if (accepted === false) {
    return NextResponse.json({ error: 'Please read and agree to the community rules first.', code: 'rules' }, { status: 403 });
  }
  if (accepted === null && kind === 'tidbit') {
    return NextResponse.json({ error: 'Tidbits open soon.', code: 'soon' }, { status: 503 });
  }

  // Moderation: no slurs; swear words bleeped; the rest checked for a moderator.
  const moderated = moderateFields({ title, body: markdown, unlocking_moment, what_didnt_work });
  if (moderated.slur) {
    return NextResponse.json({ error: SLUR_MESSAGE, code: 'slur' }, { status: 400 });
  }
  const review = draft ? { flag: null, reason: null, selfHarm: false } : await reviewFlag(`${moderated.fields.title}\n\n${moderated.fields.body}`);
  if (review.selfHarm && !content_note) content_note = 'self_harm';

  // Lazily create a community profile so first-time posters are auto-opted-in.
  // We try a couple of pseudonyms in case of UNIQUE collisions.
  const { data: existingProfile } = await client
    .from('community_profiles')
    .select('user_id')
    .eq('user_id', viewer.user_id)
    .maybeSingle();
  if (!existingProfile) {
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const candidate = generatePseudonym();
      const { error: insErr } = await client
        .from('community_profiles')
        .insert({ user_id: viewer.user_id, pseudonym: candidate });
      if (!insErr) inserted = true;
      else if (!insErr.message?.includes('duplicate')) {
        console.warn('[community] auto-profile insert failed:', insErr.message);
        break;
      }
    }
  }

  // Whose experience is this? (Odosa) Snapshotted at write time, like ratings.
  const authorRel = await authorRelationshipSnapshot(viewer.user_id)

  const row: Record<string, unknown> = {
    author_id: viewer.user_id,
    title: moderated.fields.title,
    body_markdown: moderated.fields.body,
    barrier_tags,
    category_tags,
    image_urls,
    unlocking_moment: moderated.fields.unlocking_moment,
    what_didnt_work: moderated.fields.what_didnt_work,
    author_relationships: authorRel.relationships,
    author_weight: authorRel.weight,
  };
  const tidbitRow =
    accepted === null
      ? {}
      : {
          kind,
          length_type,
          status,
          is_anonymous,
          group_id: group?.id ?? null,
          source,
          external_url,
          external_platform,
          external_platform_url,
          byline,
          auto_flag: review.flag,
          auto_flag_reason: review.reason,
        };
  let { data: post, error } = await client
    .from('community_posts')
    .insert({ ...row, ...tidbitRow, ...(content_note ? { content_note } : {}) })
    .select('id')
    .single();
  // Before STEP 75 there is no content_note column: keep the post.
  if (content_note && missingContentNote(error)) {
    ({ data: post, error } = await client.from('community_posts').insert({ ...row, ...tidbitRow }).select('id').single());
  }
  if (error || !post) {
    const friendly = dbErrorMessage(error);
    if (friendly) return NextResponse.json({ error: friendly }, { status: 400 });
    console.error('[community] POST /posts failed:', error?.message);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }

  // The services and products it mentions (Integrated Resources).
  if (kind === 'tidbit') {
    const items = await checkedItems(client, body.items);
    if (items.length) {
      await client.from('community_post_items').insert(items.map((i, n) => ({ post_id: post!.id, item_kind: i.kind, item_id: i.id, sort_order: n })));
    }
  }

  // Award the first-post badge if applicable. Best-effort.
  if (!draft) {
    try {
      await client.rpc('community_award_threshold_badges', {
        p_user_id: viewer.user_id,
      });
    } catch (err) {
      console.warn('[community] threshold badge award failed:', err);
    }
  }

  return NextResponse.json(
    { id: post.id, status, bleeped: moderated.bleeped, flagged: review.flag === 'review' },
    { status: 201 }
  );
}
