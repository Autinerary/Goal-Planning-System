import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Whether the signed-in person is an admin, for ResourceHub's admin area and
 * the jobs only admins may start. Admin is either profiles.role = 'admin',
 * which since STEP 68 only the team can set, or a row in public.admin_users
 * (STEP 55), which Tidbits already used through is_admin(). Pass the role
 * already read from the person's own profile; is_admin() is asked only when
 * that isn't 'admin'. Uses the person's own session.
 */
export async function isAdminUser(supabase: SupabaseClient, role?: string | null): Promise<boolean> {
  if (role === 'admin') return true
  const { data } = await supabase.rpc('is_admin')
  return data === true
}
