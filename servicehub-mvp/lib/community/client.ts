/**
 * Tidbits — service-role helpers used by every community API route.
 *
 * Wraps `createAdminClient()` with the project's "no-op when unconfigured"
 * pattern: if SUPABASE_SERVICE_ROLE_KEY is missing (e.g. running locally
 * without a .env), we log once and return `null` instead of throwing. The
 * caller is expected to short-circuit with a 503-style response.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

let warned = false;

/**
 * Returns an admin Supabase client or null if env vars are missing.
 * Use this for any community write (vote, accept, post, etc.) so RLS
 * bypassing is centralised through a single audited call site.
 */
export function getCommunityServiceClient(): SupabaseClient | null {
  try {
    return createAdminClient();
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn(
        '[community] Supabase service role key not configured — community features will return 503.'
      );
    }
    return null;
  }
}

/**
 * Whether the signed-in caller is an admin: a row in public.admin_users
 * (STEP 55), checked by the database for this session only. Admin routes
 * gate on this and then write with the caller's own session, so RLS policies
 * that call is_admin() decide what they may change (STEP 58).
 */
export async function isCommunityAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

/** What a banned or suspended person is told when they try to post, answer, vote, comment, rate or review. */
export const CANT_POST_MESSAGE =
  "Your account can't post right now. If you think this is a mistake, write to heydevs@autinerary.ca and we'll look at it with you.";

function pausedUntilMessage(until: Date): string {
  const day = until.toLocaleDateString('en-CA', { day: 'numeric', month: 'long', timeZone: 'America/Toronto' });
  return `Your account is paused from posting until ${day}. If you think this is a mistake, write to heydevs@autinerary.ca and we'll look at it with you.`;
}

/**
 * Why this person may not write in the community right now (posts, answers,
 * votes, comments, ratings, product reviews), as a kind message, or null when
 * they may. Refused: profiles.role = 'banned', or a community suspension
 * (community_profiles.is_suspended) with no end date or one still to come.
 * A ban used to stop nothing here: the viewer stopped reading profiles.role
 * (bug audit, 17 November 2026, item 9). STEP 105 adds a database trigger with
 * the same rule; this check comes first so people get a kind message.
 *
 * Read as the service, since the suspension columns are moderators' to set.
 * If the check itself can't run, it doesn't block (the trigger still does).
 */
export async function postingBlockedReason(userId: string, client?: SupabaseClient | null): Promise<string | null> {
  const db = client ?? getCommunityServiceClient();
  if (!db || !userId) return null;
  try {
    const [{ data: profile }, { data: community }] = await Promise.all([
      db.from('profiles').select('role').eq('id', userId).maybeSingle(),
      db.from('community_profiles').select('is_suspended, suspended_until').eq('user_id', userId).maybeSingle(),
    ]);
    if ((profile as { role?: string | null } | null)?.role === 'banned') return CANT_POST_MESSAGE;
    const c = community as { is_suspended?: boolean | null; suspended_until?: string | null } | null;
    if (c?.is_suspended) {
      if (!c.suspended_until) return CANT_POST_MESSAGE;
      const until = new Date(c.suspended_until);
      if (Number.isNaN(until.getTime())) return CANT_POST_MESSAGE;
      if (until.getTime() > Date.now()) return pausedUntilMessage(until);
    }
    return null;
  } catch (err) {
    console.warn('[community] posting check skipped:', err);
    return null;
  }
}

/**
 * The database's own refusal (STEP 105's trigger: errcode P0001, "This account
 * can't post right now."), so a route can answer with the kind message
 * instead of a generic failure.
 */
export function isPostingBlockedError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'P0001' && /can.?t post right now/i.test(error.message || '');
}

export interface CommunityViewer {
  user_id: string;
  is_admin: boolean;
  /**
   * Only when asked for with { forWriting: true }: the kind message to show
   * when this person may not write right now (banned or suspended), else null.
   * Always null when not asked for.
   */
  blocked: string | null;
}

/**
 * Resolve the currently signed-in user. Returns null if no session.
 * Use the cookie-bound `createClient()` so RLS still applies for reads.
 *
 * is_admin is the same answer the admin routes and policies use
 * (public.admin_users), so a page offers moderation only to the people the
 * database lets moderate. It used to read profiles.role.
 *
 * Routes that write (post, answer, vote, comment) pass { forWriting: true }
 * and refuse when `blocked` is set: a banned or suspended person can still
 * read, but not write.
 */
export async function getCommunityViewer(options: { forWriting?: boolean } = {}): Promise<CommunityViewer | null> {
  try {
    const supa = createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) return null;
    const [is_admin, blocked] = await Promise.all([
      isCommunityAdmin(supa),
      options.forWriting ? postingBlockedReason(user.id) : Promise.resolve(null),
    ]);
    return { user_id: user.id, is_admin, blocked };
  } catch (err) {
    console.warn('[community] Failed to load viewer:', err);
    return null;
  }
}
