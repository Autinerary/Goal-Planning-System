import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Other people's profiles, public fields only.
 *
 * Since STEP 64 (backend/database/migrations/2026_profile_privacy.sql) a
 * person can read only their own row of public.profiles; what others may see
 * comes from the public_profiles view, for the same people as before (your
 * own, discoverable profiles, and anyone a connection or pending request
 * links you to). Before STEP 64 is applied the view doesn't exist, so this
 * falls back to profiles with the fields that existed then. Never select
 * email, date of birth or preferences for someone else.
 */

export interface PublicProfile {
  id: string
  display_name: string | null
  avatar_emoji: string | null
  dream: string | null
  username?: string | null
  pronouns?: string | null
  bio?: string | null
  avatar_url?: string | null
}

export const PUBLIC_PROFILE_FIELDS = 'id, display_name, avatar_emoji, dream, username, pronouns, bio, avatar_url'
const BEFORE_STEP_64 = 'id, display_name, avatar_emoji, dream'

/** True when the error means STEP 64 isn't applied yet (no view, function or column). */
export function step64Missing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code || '')
  return ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code) ||
    /public_profiles|search_profiles|does not exist|could not find/i.test(String(error.message || ''))
}

export async function publicProfilesByIds(supabase: SupabaseClient, ids: string[]): Promise<Record<string, PublicProfile>> {
  const out: Record<string, PublicProfile> = {}
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (!unique.length) return out
  let res: { data: any[] | null; error: any } = await supabase.from('public_profiles').select(PUBLIC_PROFILE_FIELDS).in('id', unique)
  if (res.error && step64Missing(res.error)) {
    res = await supabase.from('profiles').select(BEFORE_STEP_64).in('id', unique)
  }
  if (res.error) {
    console.error('public profiles:', res.error.message)
    return out
  }
  for (const p of res.data || []) out[p.id] = p as PublicProfile
  return out
}
