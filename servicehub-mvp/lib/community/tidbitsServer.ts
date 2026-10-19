/**
 * Tidbits on the server (the Tidbits round, STEP 83): the groups, how a post
 * shows in a list, the rules check, the services and products a Tidbit
 * mentions, and the database's own messages. Used by the community routes.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { primaryRelationship } from '@/lib/trust/authorRelationship'
import { markdownExcerpt } from '@/lib/community/markdown'
import { isContentNote } from '@/lib/community/contentNotes'
import { RULES_VERSION, shownAuthor, step83Missing } from '@/lib/community/tidbits'
import type { CommunityAuthorBadge, CommunityPostSummary } from '@/types/community'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The groups, by id (for the feed) and by slug (for filters and posting). */
export async function loadGroups(client: SupabaseClient) {
  const { data, error } = await client.from('community_groups').select('id, slug, name').order('sort_order');
  const rows = error ? [] : ((data ?? []) as { id: string; slug: string; name: string }[]);
  return { byId: new Map(rows.map((g) => [g.id, g])), bySlug: new Map(rows.map((g) => [g.slug, g])) };
}

/** A feed row as the page shows it, with who it shows as. */
export function summarize(
  r: any,
  author: CommunityAuthorBadge | undefined,
  viewer: { user_id: string; is_admin: boolean } | null,
  vote: -1 | 0 | 1,
  group: { slug: string; name: string } | null
): CommunityPostSummary {
  return {
    id: r.id,
    title: r.title,
    // A post with a content note shows the note, not its first lines.
    excerpt: isContentNote(r.content_note) ? '' : markdownExcerpt(r.body_markdown, 220),
    content_note: isContentNote(r.content_note) ? r.content_note : null,
    unlocking_moment: r.unlocking_moment ?? null,
    what_didnt_work: r.what_didnt_work ?? null,
    author_relationship: r.is_anonymous || r.byline ? null : primaryRelationship(r.author_relationships),
    author: shownAuthor(r, author as any, viewer) as CommunityAuthorBadge,
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
    viewer_vote: vote,
    ...(r.kind
      ? {
          kind: r.kind,
          length_type: r.length_type ?? null,
          status: r.status,
          is_anonymous: !!r.is_anonymous,
          group,
          source: r.source,
          external_url: r.external_url ?? null,
          external_platform: r.external_platform ?? null,
          external_platform_url: r.external_platform_url ?? null,
          byline: r.byline ?? null,
          word_count: r.word_count ?? 0,
          published_at: r.published_at ?? null,
          bite_count: r.bite_count ?? 0,
          well_done_count: r.well_done_count ?? 0,
          well_done_avg: r.well_done_count ? Math.round((r.well_done_sum / r.well_done_count) * 10) / 10 : null,
          item_count: r.item_count ?? 0,
        }
      : {}),
  };
}

/** Whether this person accepted the current community rules (STEP 83); null before it. */
export async function rulesAccepted(client: SupabaseClient, userId: string): Promise<boolean | null> {
  const { data, error } = await client.from('community_rules_acceptances').select('version').eq('user_id', userId).maybeSingle();
  if (error) return step83Missing(error) ? null : true;
  return !!data && data.version >= RULES_VERSION;
}

/** Keep only services and products that exist and are live. */
export async function checkedItems(client: SupabaseClient, items: unknown) {
  const wanted = (Array.isArray(items) ? (items as { kind?: string; id?: string }[]) : [])
    .filter((i) => (i?.kind === 'resource' || i?.kind === 'product') && typeof i.id === 'string' && UUID.test(i.id))
    .slice(0, 8) as { kind: 'resource' | 'product'; id: string }[];
  const ids = (k: string) => wanted.filter((w) => w.kind === k).map((w) => w.id);
  const [res, prod] = await Promise.all([
    ids('resource').length ? client.from('resources').select('id').in('id', ids('resource')).eq('status', 'approved') : { data: [] },
    ids('product').length ? client.from('products').select('id').in('id', ids('product')).eq('status', 'active') : { data: [] },
  ]);
  const ok = new Set([...((res.data as any[]) ?? []).map((r) => `resource:${r.id}`), ...((prod.data as any[]) ?? []).map((r) => `product:${r.id}`)]);
  return wanted.filter((w) => ok.has(`${w.kind}:${w.id}`));
}

export function dbErrorMessage(error: { message?: string; hint?: string } | null): string | null {
  const hint = (error as any)?.hint || '';
  if (hint === 'too_long') return error?.message || 'Keep it short and sweet.';
  if (hint === 'not_member') return 'Join the group first: open Groups and choose Join.';
  return null;
}
