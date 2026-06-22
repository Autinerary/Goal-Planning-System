/**
 * Tidbits — author + vote hydration helpers.
 *
 * The feed/detail endpoints have to attach author info (pseudonym, karma,
 * top badges) to every post and answer they return, and also surface the
 * current viewer's own vote so the UI can highlight up/down state. Doing
 * this inline in every endpoint led to N+1 queries; this module batches
 * the lookups into 2-3 queries no matter how many rows the caller has.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CommunityAuthorBadge,
  BadgeGrantRow,
  BadgeRow,
  VoteTarget,
} from '@/types/community';

/**
 * Build a Map<user_id, CommunityAuthorBadge> for every author referenced.
 * Falls back to a placeholder if the row is missing (deleted account).
 */
export async function loadAuthorMap(
  client: SupabaseClient,
  authorIds: string[]
): Promise<Map<string, CommunityAuthorBadge>> {
  const ids = Array.from(new Set(authorIds.filter(Boolean)));
  const out = new Map<string, CommunityAuthorBadge>();
  if (ids.length === 0) return out;

  // Profiles (community + base) ------------------------------------------------
  const { data: profiles, error } = await client
    .from('community_profiles')
    .select(
      'user_id, pseudonym, avatar_url, karma, is_public'
    )
    .in('user_id', ids);
  if (error) {
    console.warn('[community] loadAuthorMap profile load failed:', error.message);
  }

  // Badge grants for the top-3 per user -------------------------------------
  const { data: grants, error: grantErr } = await client
    .from('community_badge_grants')
    .select(
      'id, user_id, badge_slug, granted_at, granted_by, badge:community_badges(slug, name, description, icon, tier, auto_metric, auto_threshold)'
    )
    .in('user_id', ids)
    .order('granted_at', { ascending: false });
  if (grantErr) {
    console.warn('[community] loadAuthorMap badge load failed:', grantErr.message);
  }

  const byUser = new Map<string, BadgeGrantRow[]>();
  for (const g of (grants as unknown as Array<BadgeGrantRow & { badge: BadgeRow | null }>) ?? []) {
    const arr = byUser.get(g.user_id) ?? [];
    if (arr.length < 3) arr.push(g);
    byUser.set(g.user_id, arr);
  }

  for (const p of (profiles ?? []) as Array<{
    user_id: string;
    pseudonym: string;
    avatar_url: string | null;
    karma: number;
    is_public: boolean;
  }>) {
    out.set(p.user_id, {
      user_id: p.user_id,
      pseudonym: p.pseudonym,
      avatar_url: p.avatar_url,
      karma: p.karma,
      is_public: p.is_public,
      top_badges: byUser.get(p.user_id) ?? [],
    });
  }

  // For author IDs that don't have a community profile yet, surface a
  // safe placeholder so the UI doesn't crash. These users haven't
  // opted in to the community, so they shouldn't even have posts; but
  // an admin-deleted profile leaves orphans, so we handle the case.
  for (const id of ids) {
    if (!out.has(id)) {
      out.set(id, {
        user_id: id,
        pseudonym: 'former_member',
        avatar_url: null,
        karma: 0,
        is_public: false,
        top_badges: [],
      });
    }
  }
  return out;
}

/**
 * Build a Map<target_id, viewer_vote> for the given target type. Returns
 * an empty map if no viewer is set.
 */
export async function loadViewerVotes(
  client: SupabaseClient,
  viewerId: string | null,
  targetType: VoteTarget,
  targetIds: string[]
): Promise<Map<string, -1 | 0 | 1>> {
  const out = new Map<string, -1 | 0 | 1>();
  if (!viewerId || targetIds.length === 0) return out;
  const { data, error } = await client
    .from('community_votes')
    .select('target_id, value')
    .eq('voter_id', viewerId)
    .eq('target_type', targetType)
    .in('target_id', targetIds);
  if (error) {
    console.warn('[community] loadViewerVotes failed:', error.message);
    return out;
  }
  for (const row of (data ?? []) as Array<{ target_id: string; value: -1 | 1 }>) {
    out.set(row.target_id, row.value);
  }
  return out;
}
