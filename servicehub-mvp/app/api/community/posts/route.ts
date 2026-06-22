/**
 * /api/community/posts
 *   GET  — paginated feed with sort + filters
 *   POST — create a new post (requires opted-in community profile)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';
import { markdownExcerpt } from '@/lib/community/markdown';
import { loadAuthorMap, loadViewerVotes } from '@/lib/community/hydrate';
import { generatePseudonym } from '@/lib/community/pseudonym';
import type {
  CommunityPostSummary,
  FeedSort,
} from '@/types/community';

export const dynamic = 'force-dynamic';

const SORTS: ReadonlyArray<FeedSort> = ['recent', 'top', 'unanswered', 'solved'];

function parseSort(input: string | null): FeedSort {
  if (!input) return 'recent';
  return (SORTS as string[]).includes(input) ? (input as FeedSort) : 'recent';
}

export async function GET(request: NextRequest) {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ posts: [], page: 1, page_size: 0 }, { status: 503 });
  }
  const viewer = await getCommunityViewer();

  const url = new URL(request.url);
  const sort = parseSort(url.searchParams.get('sort'));
  const q = url.searchParams.get('q')?.trim() || null;
  const barrier = url.searchParams.get('barrier')?.trim() || null;
  const category = url.searchParams.get('category')?.trim() || null;
  const author = url.searchParams.get('author')?.trim() || null;
  const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
  const sizeRaw = parseInt(url.searchParams.get('page_size') ?? '20', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Math.min(50, Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : 20);
  const offset = (page - 1) * pageSize;

  let query = client
    .from('community_posts')
    .select(
      'id, author_id, title, body_markdown, barrier_tags, category_tags, image_urls, upvotes, downvotes, score, answer_count, view_count, accepted_answer_id, solved_tldr, solved_key_insight, is_locked, last_activity_at, created_at'
    )
    .eq('is_deleted', false);

  if (barrier) query = query.contains('barrier_tags', [barrier]);
  if (category) query = query.contains('category_tags', [category]);
  if (author) query = query.eq('author_id', author);
  if (q) query = query.or(`title.ilike.%${q}%,body_markdown.ilike.%${q}%`);
  if (sort === 'unanswered') query = query.eq('answer_count', 0);
  if (sort === 'solved') query = query.not('accepted_answer_id', 'is', null);

  if (sort === 'top') {
    query = query.order('score', { ascending: false }).order('last_activity_at', { ascending: false });
  } else {
    query = query.order('last_activity_at', { ascending: false });
  }
  query = query.range(offset, offset + pageSize - 1);

  const { data: rows, error } = await query;
  if (error) {
    console.error('[community] GET /posts failed:', error.message);
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 });
  }

  const authorMap = await loadAuthorMap(client, (rows ?? []).map((r) => r.author_id));
  const votes = await loadViewerVotes(
    client,
    viewer?.user_id ?? null,
    'post',
    (rows ?? []).map((r) => r.id)
  );

  const posts: CommunityPostSummary[] = (rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    excerpt: markdownExcerpt(r.body_markdown, 220),
    author: authorMap.get(r.author_id) ?? {
      user_id: r.author_id,
      pseudonym: 'former_member',
      avatar_url: null,
      karma: 0,
      is_public: false,
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
    viewer_vote: votes.get(r.id) ?? 0,
  }));

  return NextResponse.json({ posts, page, page_size: pageSize });
}

interface CreatePostBody {
  title?: string;
  body_markdown?: string;
  barrier_tags?: string[];
  category_tags?: string[];
  image_urls?: string[];
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

  const title = (body.title ?? '').trim();
  const markdown = (body.body_markdown ?? '').trim();
  const barrier_tags = (body.barrier_tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && t.length <= 32)
    .slice(0, 10);
  const category_tags = (body.category_tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && t.length <= 32)
    .slice(0, 5);
  const image_urls = (body.image_urls ?? [])
    .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
    .slice(0, 6);

  if (title.length < 8 || title.length > 250) {
    return NextResponse.json({ error: 'Title must be 8-250 characters' }, { status: 400 });
  }
  if (markdown.length < 20 || markdown.length > 30000) {
    return NextResponse.json({ error: 'Body must be 20-30,000 characters' }, { status: 400 });
  }

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

  const { data: post, error } = await client
    .from('community_posts')
    .insert({
      author_id: viewer.user_id,
      title,
      body_markdown: markdown,
      barrier_tags,
      category_tags,
      image_urls,
    })
    .select('id')
    .single();
  if (error || !post) {
    console.error('[community] POST /posts failed:', error?.message);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }

  // Award the first-post badge if applicable. Best-effort.
  try {
    await client.rpc('community_award_threshold_badges', {
      p_user_id: viewer.user_id,
    });
  } catch (err) {
    console.warn('[community] threshold badge award failed:', err);
  }

  return NextResponse.json({ id: post.id }, { status: 201 });
}
