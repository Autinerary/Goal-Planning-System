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
 * Resolve the currently signed-in user. Returns null if no session.
 * Use the cookie-bound `createClient()` so RLS still applies for reads.
 */
export async function getCommunityViewer(): Promise<{
  user_id: string;
  is_admin: boolean;
} | null> {
  try {
    const supa = createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supa
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    return {
      user_id: user.id,
      is_admin: profile?.role === 'admin',
    };
  } catch (err) {
    console.warn('[community] Failed to load viewer:', err);
    return null;
  }
}
